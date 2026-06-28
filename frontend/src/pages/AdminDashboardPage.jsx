import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ExcelJS from 'exceljs';
import { getDashboardStats } from '../services/reportService';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';

const ACCENT_COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#8B5CF6', '#EC4899'];

const formatCurrency = (value) => new Intl.NumberFormat('vi-VN').format(value || 0);
const formatDate = (value) => (value ? new Date(value).toLocaleDateString('vi-VN') : '--');
const formatMonthLabel = (value) => {
  if (!value) return '--';
  const date = new Date(`${value}-01`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('vi-VN', { month: 'short', year: 'numeric' }).format(date);
};
const getTodayTimestamp = () => new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'medium' }).format(new Date());
const safeArray = (value) => (Array.isArray(value) ? value : []);
const formatExcelCurrency = (value) => Number(value || 0);

const statIcons = {
  revenue: (<svg viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ width: '22px', height: '22px' }}><path d="M12 2v20M17 6.5c0-1.93-2.24-3.5-5-3.5S7 4.57 7 6.5 9.24 10 12 10s5 1.57 5 3.5S14.76 17 12 17s-5-1.57-5-3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>),
  stock: (<svg viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ width: '22px', height: '22px' }}><path d="M4 7.5 12 4l8 3.5-8 3.5-8-3.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /><path d="M4 7.5V16.5L12 20l8-3.5V7.5" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>),
  processing: (<svg viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ width: '22px', height: '22px' }}><path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /><circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" /></svg>),
  alert: (<svg viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ width: '22px', height: '22px' }}><path d="m10.29 4.86-7.43 12.8A2 2 0 0 0 4.58 21h14.84a2 2 0 0 0 1.72-3.34l-7.43-12.8a2 2 0 0 0-3.44 0Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /><path d="M12 9v4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" /><path d="M12 17h.01" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" /></svg>),
};

const statusMeta = {
  completed: { label: 'Hoàn tất', bg: '#DCFCE7', color: '#166534' },
  pending: { label: 'Chờ xử lý', bg: '#FEF3C7', color: '#92400E' },
  warehouse_processing: { label: 'Đang xử lý', bg: '#DBEAFE', color: '#1D4ED8' },
  rejected: { label: 'Từ chối', bg: '#FEE2E2', color: '#B91C1C' },
  delayed: { label: 'Dời ngày', bg: '#FFEDD5', color: '#C2410C' },
  returned: { label: 'Hoàn trả', bg: '#F3E8FF', color: '#7C3AED' },
};

function StatButtonCard({ label, value, hint, icon, accent, hoverColor, hovered, onMouseEnter, onMouseLeave }) {
  return (
    <div className="dashboard-hover-card dashboard-stat-card" onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}
      style={{ background: hovered ? 'linear-gradient(180deg, #FFFDF6 0%, #FFFFFF 100%)' : '#fff', borderRadius: 20, padding: 20, boxShadow: hovered ? '0 18px 40px rgba(15, 23, 42, 0.12)' : '0 10px 30px rgba(15, 23, 42, 0.06)', border: hovered ? `1px solid ${hoverColor}` : '1px solid #EEF2F7', display: 'flex', flexDirection: 'column', gap: 14, textAlign: 'left', width: '100%', transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease, background 0.2s ease', transform: hovered ? 'translateY(-4px)' : 'translateY(0)', cursor: 'default' }}>
      <div style={{ width: 46, height: 46, borderRadius: 14, background: accent, color: '#fff', display: 'grid', placeItems: 'center', transition: 'transform 0.2s ease, background 0.2s ease', overflow: 'hidden', boxShadow: hovered ? '0 10px 20px rgba(15, 23, 42, 0.12)' : 'none' }}>{icon}</div>
      <div>
        <div style={{ fontSize: 13, color: hovered ? '#0F172A' : '#64748B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: hovered ? '0.02em' : '0' }}>{label}</div>
        <div style={{ fontSize: 30, fontWeight: 800, color: '#0F172A', marginTop: 6 }}>{value}</div>
        {hint ? <div style={{ fontSize: 12, color: hovered ? '#475569' : '#94A3B8', marginTop: 6 }}>{hint}</div> : null}
      </div>
    </div>
  );
}

function SectionCard({ title, subtitle, children }) {
  return (
    <div className="dashboard-hover-card" style={{ background: '#fff', borderRadius: 24, padding: 20, border: '1px solid #EEF2F7', boxShadow: '0 18px 42px rgba(15, 23, 42, 0.10)', transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease, background 0.2s ease' }}>
      <div style={{ marginBottom: 16 }}><div style={{ fontSize: 18, fontWeight: 800, color: '#0F172A' }}>{title}</div>{subtitle ? <div style={{ fontSize: 13, color: '#64748B', marginTop: 4 }}>{subtitle}</div> : null}</div>
      {children}
    </div>
  );
}

export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState('');
  const [pageLoaded, setPageLoaded] = useState(false);
  const [hoveredCard, setHoveredCard] = useState(null);

  useEffect(() => {
    const fetchAllData = async () => {
      try { const res = await getDashboardStats(); setDashboard(res || {}); }
      catch (err) { setError(`Không thể tải dữ liệu dashboard. ${err?.response?.data?.message || err.message || ''}`.trim()); }
      finally { setLoading(false); }
    };
    const runEnterAnimation = () => { setPageLoaded(false); requestAnimationFrame(() => requestAnimationFrame(() => setPageLoaded(true))); };
    fetchAllData(); runEnterAnimation();
    window.addEventListener('pageshow', runEnterAnimation);
    return () => window.removeEventListener('pageshow', runEnterAnimation);
  }, []);

  const totalRevenue = dashboard?.total_revenue || 0;
  const totalStock = dashboard?.total_products || 0;
  const lowStockCount = dashboard?.low_stock || 0;
  const processingOrdersCount = dashboard?.processing_orders || 0;
  const recentOrders = safeArray(dashboard?.recent_orders);
  const recentActivities = safeArray(dashboard?.recent_activities);
  const monthlyImportExportData = safeArray(dashboard?.monthly_import_export).map((item) => ({ name: formatMonthLabel(item.name), Nhập: item.Nhập || 0, Xuất: item.Xuất || 0 }));
  const revenueTrend = safeArray(dashboard?.revenue_trend).map((item) => ({ name: formatMonthLabel(item.month), month: item.month, DoanhThu: item.revenue || 0 }));
  const topProductsData = safeArray(dashboard?.top_selling_products).map((item) => ({ name: item.name, value: item.value || 0 }));
  const completedOrderCount = recentOrders.filter((order) => order.status === 'completed').length;
  const lastUpdatedText = getTodayTimestamp();

  if (loading) return <div style={{ padding: 24, color: '#64748B' }}>Đang tải dữ liệu tổng quan...</div>;
  if (error) return <div style={{ padding: 24, color: '#B91C1C', background: '#FEF2F2', borderRadius: 16 }}>{error}</div>;

  return (
    <div className="dashboard-enter" style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: 4, background: 'linear-gradient(180deg, #F7FAFC 0%, #EEF4FB 100%)', borderRadius: 28, opacity: pageLoaded ? 1 : 0, transform: pageLoaded ? 'translateY(0)' : 'translateY(16px)', transition: 'opacity 320ms ease, transform 320ms ease' }}>
      <div className="dashboard-block-enter dashboard-block-delay-1" style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', flexWrap: 'wrap', padding: '0 20px', marginBottom: 4 }}>
        <div style={{ paddingLeft: 4 }}><h2 style={{ margin: 0, fontSize: 26, lineHeight: 1.2, color: '#0F172A' }}>Tổng quan hệ thống</h2><p style={{ margin: '8px 0 0', color: '#64748B' }}>Cập nhật lần cuối: {lastUpdatedText}</p></div>
      </div>
      <div className="dashboard-block-enter dashboard-block-delay-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16 }}>
        <StatButtonCard label="Tổng doanh thu" value={`${formatCurrency(totalRevenue)} đ`} hint={`${completedOrderCount} đơn hoàn tất`} icon={statIcons.revenue} accent="linear-gradient(135deg, #10B981, #059669)" hoverColor="#10B981" hovered={hoveredCard === 'revenue'} onMouseEnter={() => setHoveredCard('revenue')} onMouseLeave={() => setHoveredCard(null)} />
        <StatButtonCard label="Tổng sản phẩm" value={formatCurrency(totalStock)} hint="Dữ liệu từ báo cáo tổng hợp" icon={statIcons.stock} accent="linear-gradient(135deg, #3B82F6, #2563EB)" hoverColor="#3B82F6" hovered={hoveredCard === 'stock'} onMouseEnter={() => setHoveredCard('stock')} onMouseLeave={() => setHoveredCard(null)} />
        <StatButtonCard label="Đơn đang xử lý" value={processingOrdersCount} hint="Chờ xử lý / đang xử lý / kho" icon={statIcons.processing} accent="linear-gradient(135deg, #F59E0B, #D97706)" hoverColor="#F59E0B" hovered={hoveredCard === 'processing'} onMouseEnter={() => setHoveredCard('processing')} onMouseLeave={() => setHoveredCard(null)} />
        <StatButtonCard label="Sản phẩm sắp hết" value={lowStockCount} hint="Cần nhập bổ sung" icon={statIcons.alert} accent="linear-gradient(135deg, #EF4444, #DC2626)" hoverColor="#EF4444" hovered={hoveredCard === 'alert'} onMouseEnter={() => setHoveredCard('alert')} onMouseLeave={() => setHoveredCard(null)} />
      </div>
      <div className="dashboard-block-enter dashboard-block-delay-3" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        <SectionCard title="Nhập kho và xuất kho" subtitle="Biến động hàng tháng từ dữ liệu thật">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={monthlyImportExportData} barCategoryGap={18}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} />
              <YAxis axisLine={false} tickLine={false} />
              <RechartsTooltip cursor={{ fill: '#F8FAFC' }} />
              <Bar dataKey="Nhập" fill="#10B981" radius={[10, 10, 0, 0]} />
              <Bar dataKey="Xuất" fill="#60A5FA" radius={[10, 10, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>
        <SectionCard title="Sản phẩm bán chạy nhất" subtitle="Theo số lượng từ đơn hoàn tất">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart><Pie data={topProductsData} dataKey="value" nameKey="name" innerRadius={64} outerRadius={90} paddingAngle={4}>{topProductsData.map((entry, index) => <Cell key={entry.name} fill={ACCENT_COLORS[index % ACCENT_COLORS.length]} />)}</Pie><RechartsTooltip /></PieChart>
            </ResponsiveContainer>
            <div style={{ width: '100%', display: 'grid', gap: 8, marginTop: 4 }}>
              {topProductsData.map((item, index) => (<div key={item.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#475569' }}><span><span style={{ color: ACCENT_COLORS[index % ACCENT_COLORS.length] }}>●</span> {item.name}</span><strong>{item.value}</strong></div>))}
            </div>
          </div>
        </SectionCard>
      </div>
      <div className="dashboard-block-enter dashboard-block-delay-4" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <SectionCard title="Xu hướng doanh thu" subtitle="Doanh thu theo tháng từ đơn hoàn tất">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={revenueTrend} barCategoryGap={18}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} />
              <YAxis axisLine={false} tickLine={false} />
              <RechartsTooltip formatter={(value) => `${formatCurrency(value)} đ`} />
              <Bar dataKey="DoanhThu" fill="#8B5CF6" radius={[10, 10, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>
        <SectionCard title="Sức khỏe vận hành" subtitle="Tổng hợp chỉ số nhanh">
          <div style={{ display: 'grid', gap: 12 }}>
            {[{ label: 'Tổng doanh thu', value: `${formatCurrency(totalRevenue)} đ`, color: '#10B981' }, { label: 'Tổng tồn kho', value: `${formatCurrency(totalStock)} SP`, color: '#3B82F6' }, { label: 'Đơn hoàn tất', value: `${completedOrderCount} đơn`, color: '#8B5CF6' }, { label: 'Đơn đang xử lý', value: `${processingOrdersCount} đơn`, color: '#EF4444' }].map((item) => (
              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderRadius: 16, background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                <span style={{ color: '#475569', fontWeight: 600 }}>{item.label}</span>
                <span style={{ fontWeight: 800, color: item.color }}>{item.value}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
      <div className="dashboard-block-enter dashboard-block-delay-5" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <SectionCard title="Đơn hàng gần nhất" subtitle="Hoạt động đơn hàng mới nhất">
          <div style={{ display: 'grid', gap: 10 }}>
            {recentOrders.length === 0 ? <div style={{ padding: 18, textAlign: 'center', color: '#64748B', background: '#F8FAFC', borderRadius: 16 }}>Chưa có dữ liệu đơn hàng.</div> : recentOrders.map((order) => {
              const meta = statusMeta[order.status] || { label: order.status || 'Không rõ', bg: '#E2E8F0', color: '#334155' };
              return (
                <div key={order.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderRadius: 16, background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                  <div><div style={{ fontWeight: 700, color: '#0F172A' }}>{order.order_no}</div><div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>{order.customer_name} • {formatDate(order.expected_delivery_date)}</div></div>
                  <span style={{ fontSize: 12, fontWeight: 700, padding: '6px 10px', borderRadius: 999, background: meta.bg, color: meta.color }}>{meta.label}</span>
                </div>
              );
            })}
          </div>
        </SectionCard>
        <SectionCard title="Nhập xuất gần nhất" subtitle="Lịch sử vận chuyển kho">
          <div style={{ display: 'grid', gap: 10 }}>
            {recentActivities.length === 0 ? <div style={{ padding: 18, textAlign: 'center', color: '#64748B', background: '#F8FAFC', borderRadius: 16 }}>Chưa có hoạt động nhập xuất.</div> : recentActivities.map((activity, index) => (
              <div key={`${activity.type}-${activity.id || index}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderRadius: 16, background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                <div><div style={{ fontWeight: 700, color: '#0F172A' }}>{activity.type}</div><div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>{activity.code || activity.reference_no || activity.order_no || 'N/A'} • {formatDate(activity.activity_date)}</div></div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#0EA5E9' }}>{activity.status || 'logged'}</div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
