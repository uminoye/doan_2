-- ============================================================
-- INVENTORY MANAGEMENT SYSTEM - PostgreSQL Schema (Neon)
-- Chuyển đổi từ SQLite → PostgreSQL
-- ============================================================

BEGIN;

-- KHOI TAO BANG VAI TRO (ROLES)
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    description VARCHAR(255)
);

-- KHOI TAO BANG NGUOI DUNG (USERS)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role_id INTEGER,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES roles(id)
);

-- KHOI TAO BANG KHACH HANG (CUSTOMERS)
CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    customer_code VARCHAR(50) UNIQUE NOT NULL,
    company_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    address TEXT,
    contact_person VARCHAR(100),
    created_by INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- KHOI TAO BANG KHO HANG (WAREHOUSES)
CREATE TABLE IF NOT EXISTS warehouses (
    id SERIAL PRIMARY KEY,
    warehouse_code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    location TEXT
);

-- KHOI TAO BANG SAN PHAM (PRODUCTS)
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    sku VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    unit VARCHAR(50),
    category VARCHAR(100),
    image_url TEXT,
    min_stock INTEGER DEFAULT 50,
    sale_price DECIMAL(15, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- KHOI TAO BANG PHIEU NHAP KHO TU NHA MAY (PRODUCTION RECEIPTS)
CREATE TABLE IF NOT EXISTS production_receipts (
    id SERIAL PRIMARY KEY,
    receipt_no VARCHAR(50) UNIQUE NOT NULL,
    warehouse_id INTEGER,
    receipt_date TIMESTAMP NOT NULL,
    created_by INTEGER,
    responded_by VARCHAR(100),
    responded_reason TEXT,
    expected_delivery_date TIMESTAMP,
    status VARCHAR(50) DEFAULT 'pending',
    note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- CHI TIET PHIEU NHAP KHO
CREATE TABLE IF NOT EXISTS production_receipt_items (
    id SERIAL PRIMARY KEY,
    receipt_id INTEGER,
    product_id INTEGER,
    quantity INTEGER NOT NULL,
    FOREIGN KEY (receipt_id) REFERENCES production_receipts(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- KHOI TAO BANG DON HANG XUAT (SALES ORDERS)
CREATE TABLE IF NOT EXISTS sales_orders (
    id SERIAL PRIMARY KEY,
    order_no VARCHAR(50) UNIQUE NOT NULL,
    customer_id INTEGER,
    order_date TIMESTAMP NOT NULL,
    expected_delivery_date TIMESTAMP,
    actual_delivery_date TIMESTAMP,
    created_by INTEGER,
    status VARCHAR(50) DEFAULT 'draft',
    note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- CHI TIET DON HANG XUAT
CREATE TABLE IF NOT EXISTS sales_order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER,
    product_id INTEGER,
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(15, 2),
    FOREIGN KEY (order_id) REFERENCES sales_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- BANG QUAN LY LOGISTICS TIEP NHAN DON (DELIVERY REQUESTS)
CREATE TABLE IF NOT EXISTS delivery_requests (
    id SERIAL PRIMARY KEY,
    order_id INTEGER,
    handled_by INTEGER,
    received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) DEFAULT 'received',
    logistics_note TEXT,
    warehouse_note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES sales_orders(id),
    FOREIGN KEY (handled_by) REFERENCES users(id)
);

-- KHOI TAO BANG PHIEU XUAT KHO (STOCK OUTBOUND NOTES)
CREATE TABLE IF NOT EXISTS stock_outbound_notes (
    id SERIAL PRIMARY KEY,
    outbound_no VARCHAR(50) UNIQUE NOT NULL,
    order_id INTEGER,
    warehouse_id INTEGER,
    export_date TIMESTAMP,
    created_by INTEGER,
    status VARCHAR(50) DEFAULT 'pending',
    note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES sales_orders(id),
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- CHI TIET PHIEU XUAT KHO
CREATE TABLE IF NOT EXISTS stock_outbound_note_items (
    id SERIAL PRIMARY KEY,
    outbound_note_id INTEGER,
    product_id INTEGER,
    quantity INTEGER NOT NULL,
    FOREIGN KEY (outbound_note_id) REFERENCES stock_outbound_notes(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- BANG LUU SO TON KHO HIEN TAI (INVENTORY BALANCES)
CREATE TABLE IF NOT EXISTS inventory_balances (
    id SERIAL PRIMARY KEY,
    warehouse_id INTEGER,
    product_id INTEGER,
    on_hand_qty INTEGER DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(warehouse_id, product_id),
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- BANG LICH SU GIAO DICH KHO (INVENTORY TRANSACTIONS)
CREATE TABLE IF NOT EXISTS inventory_transactions (
    id SERIAL PRIMARY KEY,
    warehouse_id INTEGER,
    product_id INTEGER,
    transaction_type VARCHAR(20) NOT NULL,
    quantity INTEGER NOT NULL,
    reference_type VARCHAR(50),
    reference_id INTEGER,
    transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- ============================================================
-- SEED DATA
-- ============================================================

INSERT INTO roles (name, description) VALUES 
    ('Admin', 'Quan tri vien he thong'),
    ('Sales', 'Nhan vien kinh doanh'),
    ('Logistics', 'Nhan vien dieu phoi'),
    ('Warehouse', 'Nhan vien kho'),
    ('Factory', 'Nha may san xuat')
ON CONFLICT DO NOTHING;

-- Mat khau: 123456
INSERT INTO users (full_name, email, password_hash, role_id) VALUES
    ('Nguyen Van Admin', 'admin@congty.com', '$2a$10$OVgbJkkIf54Xsftf3ApaWuWzQvHtgjcG8MU7ZguKzqM9yae1FaQfy', 1),
    ('Tran Thi Sale', 'sale@congty.com', '$2a$10$OVgbJkkIf54Xsftf3ApaWuWzQvHtgjcG8MU7ZguKzqM9yae1FaQfy', 2),
    ('Le Van Logistics', 'logistics@congty.com', '$2a$10$OVgbJkkIf54Xsftf3ApaWuWzQvHtgjcG8MU7ZguKzqM9yae1FaQfy', 3),
    ('Pham Thu Kho', 'kho@congty.com', '$2a$10$OVgbJkkIf54Xsftf3ApaWuWzQvHtgjcG8MU7ZguKzqM9yae1FaQfy', 4),
    ('Truong Nha May', 'nhamay@congty.com', '$2a$10$OVgbJkkIf54Xsftf3ApaWuWzQvHtgjcG8MU7ZguKzqM9yae1FaQfy', 5)
ON CONFLICT (email) DO NOTHING;

INSERT INTO warehouses (warehouse_code, name, location) VALUES 
    ('KHO-MAIN', 'Kho Chinh Binh Duong', 'So 1, Duong So 2, KCN Song Than, Binh Duong')
ON CONFLICT (warehouse_code) DO NOTHING;

INSERT INTO products (sku, name, unit, category, sale_price) VALUES 
    ('LAP-XPS15', 'Laptop Dell XPS 15 9530', 'Cái', 'Laptop', 35000000)
ON CONFLICT (sku) DO NOTHING;
INSERT INTO products (sku, name, unit, category, sale_price) VALUES 
    ('MAC-M3', 'MacBook Pro 14 inch M3', 'Cái', 'Laptop', 39990000)
ON CONFLICT (sku) DO NOTHING;
INSERT INTO products (sku, name, unit, category, sale_price) VALUES 
    ('IPH-15P', 'iPhone 15 Pro Max 256GB', 'Chiếc', 'Điện thoại', 29500000)
ON CONFLICT (sku) DO NOTHING;
INSERT INTO products (sku, name, unit, category, sale_price) VALUES 
    ('MON-LG27', 'Màn hình LG 27 inch 4K', 'Bộ', 'Phụ kiện', 8500000)
ON CONFLICT (sku) DO NOTHING;
INSERT INTO products (sku, name, unit, category, sale_price) VALUES 
    ('KEY-MX', 'Bàn phím cơ Logitech MX Mechanical', 'Cái', 'Phụ kiện', 3200000)
ON CONFLICT (sku) DO NOTHING;

INSERT INTO customers (customer_code, company_name, phone, address, contact_person, created_by) VALUES 
    ('KH-TGDD', 'The Gioi Di Dong (MWG)', '18001060', 'Khu cong nghe cao, Quan 9, TPHCM', 'Anh Hieu (Phong Thu Mua)', 2)
ON CONFLICT (customer_code) DO NOTHING;
INSERT INTO customers (customer_code, company_name, phone, address, contact_person, created_by) VALUES 
    ('KH-FPT', 'FPT Retail', '18006601', '261 Khanh Hoi, Quan 4, TPHCM', 'Chi Mai (Quan ly chuoi)', 2)
ON CONFLICT (customer_code) DO NOTHING;
INSERT INTO customers (customer_code, company_name, phone, address, contact_person, created_by) VALUES 
    ('KH-PV', 'Phong Vu Computer', '18006867', '214 Quan Thanh, Ba Dinh, Ha Noi', 'Anh Nam (Giam doc kinh doanh)', 2)
ON CONFLICT (customer_code) DO NOTHING;
INSERT INTO customers (customer_code, company_name, phone, address, contact_person, created_by) VALUES 
    ('KH-CELL', 'CellphoneS', '18002097', '115 Thai Ha, Dong Da, Ha Noi', 'Chi Linh (Truong phong cung ung)', 2)
ON CONFLICT (customer_code) DO NOTHING;

COMMIT;
