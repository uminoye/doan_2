# Hướng dẫn Deploy - Hệ thống Quản lý Xuất Nhập Tồn

## Kiến trúc

| Layer | Công nghệ | Deploy |
|-------|-----------|--------|
| **Database** | PostgreSQL (Neon) | https://neon.tech |
| **Backend** | Express + Node.js | https://render.com |
| **Frontend** | React + Vite | https://vercel.com |

## Cách Deploy

### 1. Backend → Render

#### Cách 1: Kết nối GitHub trực tiếp (Khuyến nghị)

1. Vào [dashboard.render.com](https://dashboard.render.com) → **New** → **Web Service**
2. Connect GitHub repo `uminoye/doan_2`
3. Cấu hình:
   - **Root Directory**: `backend`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Node Version**: `20`
4. Thêm **Environment Variables**:
   - `DATABASE_URL` = connection string từ Neon
   - `JWT_SECRET` = `KHOA_BIMAT_CUA_DU_AN_XUAT_NHAP_TON`
   - `NODE_ENV` = `production`
5. Nhấn **Create Web Service** → Render tự build và deploy

#### Cách 2: Auto-deploy qua GitHub Actions

1. Tạo Web Service trên Render (không cần connect GitHub)
2. Vào Web Service → **Settings** → Copy **Deploy Hook URL**
3. Vào GitHub repo → **Settings** → **Secrets and variables** → **Actions**:
   - `RENDER_DEPLOY_WEBHOOK_URL` = deploy hook URL từ bước 2
   - `DATABASE_URL` = connection string Neon
4. Push code lên branch `main` → GitHub Actions tự deploy

### 2. Database → Neon

1. Vào [neon.tech](https://neon.tech) → Dashboard → **SQL Editor**
2. Copy toàn bộ nội dung file `database/init.sql` và paste vào → Run
3. Hoặc chạy: `cd backend && npm run init-db`

### 3. Frontend → Vercel

#### Cách 1: Vercel CLI

```bash
cd frontend
npm i -g vercel
vercel
```

#### Cách 2: GitHub + Vercel Dashboard

1. Vào [vercel.com](https://vercel.com) → **New Project** → Import repo `uminoye/doan_2`
2. Chọn folder `frontend`
3. Thêm Environment Variable:
   - `VITE_API_URL` = URL backend (ví dụ: `https://inventory-backend.onrender.com/api`)
4. Nhấn **Deploy** → Vercel tự deploy

### 4. Sau khi deploy

1. Lấy URL backend từ Render (ví dụ: `https://inventory-backend.onrender.com`)
2. Cập nhật `frontend/.env`:
   ```
   VITE_API_URL=https://inventory-backend.onrender.com/api
   ```
3. Redeploy Frontend trên Vercel

## Tài khoản Demo

| Email | Mật khẩu | Vai trò |
|-------|----------|---------|
| admin@congty.com | 123456 | Admin |
| sale@congty.com | 123456 | Sales |
| logistics@congty.com | 123456 | Logistics |
| kho@congty.com | 123456 | Warehouse |
| nhamay@congty.com | 123456 | Factory |

> ⚠️ **Lưu ý**: Mật khẩu demo đã được pre-hashed trong seed data.
> Nếu đăng nhập không được, hãy tạo tài khoản mới qua trang Quản lý Tài khoản (Admin).
