-- Create users table (Reference Table)
CREATE TABLE users (
  user_id SERIAL PRIMARY KEY,
  username TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE
);
SELECT create_reference_table('users');

-- Create products table (Reference Table)
CREATE TABLE products (
  product_id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  price NUMERIC(10, 2) NOT NULL
);
SELECT create_reference_table('products');

-- Create sequence for orders (Distributed Table)
CREATE SEQUENCE orders_order_id_seq;

-- Create orders table
CREATE TABLE orders (
  order_id INT DEFAULT nextval('orders_order_id_seq'),
  user_id INT REFERENCES users(user_id),
  total_price NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
SELECT create_distributed_table('orders', 'order_id');

-- Create sequence for order_details (Distributed Table)
CREATE SEQUENCE order_details_order_detail_id_seq;

-- Create order_details table
CREATE TABLE order_details (
  order_detail_id INT DEFAULT nextval('order_details_order_detail_id_seq'),
  order_id INT,
  product_id INT,
  quantity INT NOT NULL
);
SELECT create_distributed_table('order_details', 'order_id');

-- Populate data
-- Users
INSERT INTO users (username, email) VALUES ('JohnDoe', 'john.doe@example.com'), ('JaneSmith', 'jane.smith@example.com');

-- Products
INSERT INTO products (name, price) VALUES ('Laptop', 1000.00), ('Phone', 500.00), ('Headphones', 200.00), ('Monitor', 300.00);

DO $$ 
DECLARE 
  i INTEGER := 0; 
BEGIN 
  WHILE i < 1000 LOOP -- insert 1000 rows
    INSERT INTO orders (user_id, total_price) VALUES (floor(random() * 2 + 1)::INT, random() * 1000); 
    INSERT INTO order_details (order_id, product_id, quantity) VALUES (i + 1, floor(random() * 4 + 1)::INT, floor(random() * 10 + 1)::INT); 
    i := i + 1; 
  END LOOP; 
END $$;

-- -- Orders
-- INSERT INTO orders (user_id, total_price) VALUES (1, 1500.00), (2, 700.00), (1, 300.00), (2, 200.00);

-- -- Order Details
-- INSERT INTO order_details (order_id, product_id, quantity) VALUES (1, 1, 1), (1, 2, 1), (2, 2, 1), (2, 3, 1), (3, 4, 1), (4, 3, 1);
