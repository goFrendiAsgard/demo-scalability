# Getting started

```bash
./reset.sh
docker compose up -d
# Wait all workers to be started

./populate.sh
./inspect.sh
```

# Data

The data structure is available on `populate.sql`.

We have 4 tables:
- `products`
- `users`
- `orders`
- `order_details`

In many cases, we will need to join `orders`/`order_details` with `products` or `users`. 

We also notice that products/users table are relatively small compared to order/order details since we will probably have thousands of orders in a day.

Thus, we make `products` and `users` replicated in all servers by making them reference tables.

```sql
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
```

On the other hand, `orders` and `order_details` might grow exponentially, so it is a good idea to shard and distribute them across servers:

```sql
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
```

Please note that we use sequence instead of auto increment. We need to use sequence because we don't want our `order_id`/`order_order_detail_id` collide to each others.

# Connecting to master and workers

## From host

You can connect to master and workers using the following credentials:

- User: postgres
- Password: pass

The master will be accessible at host port `localhost:5432`, while the workers are accessible from at `localhost:5433`, `localhost:5434`, and `localhost:5435`.

## From container

You can also access the server/worker container by invoking:

```bash
docker exec -it <container-name> bash
```

To see the container names, you can invoke `docker ps`.

## Sharding in detail

For every distributed table, citus will create multiple shards and place them into different worker node.

You can see shard and placement by invoking the following query:

```sql
SELECT * FROM pg_dist_shard_placement
```

```
|shardid|shardstate|shardlength|nodename           |nodeport|placementid|
|-------|----------|-----------|-------------------|--------|-----------|
|102,008|1         |0          |citus-demo_worker_1|5,432   |1          |
|102,008|1         |0          |citus-demo_worker_2|5,432   |2          |
|102,008|1         |0          |citus-demo_worker_3|5,432   |3          |
|102,009|1         |0          |citus-demo_worker_1|5,432   |4          |
|102,067|1         |0          |citus-demo_worker_2|5,432   |64         |
|102,068|1         |0          |citus-demo_worker_3|5,432   |65         |
|102,069|1         |0          |citus-demo_worker_1|5,432   |66         |
|102,070|1         |0          |citus-demo_worker_2|5,432   |67         |
|102,071|1         |0          |citus-demo_worker_3|5,432   |68         |
|102,072|1         |0          |citus-demo_worker_1|5,432   |69         |
|102,073|1         |0          |citus-demo_worker_2|5,432   |70         |
...
```

Every shard is dedicated for specific table and distributed key range 

```sql
SELECT * FROM pg_dist_shard;
```

```
|logicalrelid |shardid|shardstorage|shardminvalue|shardmaxvalue|
|-------------|-------|------------|-------------|-------------|
|users        |102,008|t           |             |             |
|products     |102,009|t           |             |             |
|orders       |102,010|t           |-2147483648  |-2013265921  |
|orders       |102,011|t           |-2013265920  |-1879048193  |
|orders       |102,012|t           |-1879048192  |-1744830465  |
|orders       |102,013|t           |-1744830464  |-1610612737  |
|orders       |102,014|t           |-1610612736  |-1476395009  |
|orders       |102,015|t           |-1476395008  |-1342177281  |
|orders       |102,016|t           |-1342177280  |-1207959553  |
|orders       |102,017|t           |-1207959552  |-1073741825  |
...
|order_details|102,062|t           |536870912    |671088639    |
|order_details|102,063|t           |671088640    |805306367    |
|order_details|102,064|t           |805306368    |939524095    |
|order_details|102,065|t           |939524096    |1073741823   |
|order_details|102,066|t           |1073741824   |1207959551   |
|order_details|102,067|t           |1207959552   |1342177279   |
|order_details|102,068|t           |1342177280   |1476395007   |
|order_details|102,069|t           |1476395008   |1610612735   |
|order_details|102,070|t           |1610612736   |1744830463   |
|order_details|102,071|t           |1744830464   |1879048191   |
|order_details|102,072|t           |1879048192   |2013265919   |
|order_details|102,073|t           |2013265920   |2147483647   |

```

To see which shard a specific data is belong to, you can use `get_shard_id_for_distribution_column` function.

For example, you can use the folloing query to see which shard order with order_id == 1 belongs to:

```sql
SELECT get_shard_id_for_distribution_column('orders', 1)
```

```
102011
```

Now, you can make sure that order_id `1`` is located on shard `102011`

The following query will help you fetch 5 top order id and locate where physically the data is located:

```sql
WITH placement AS (
    SELECT
        shardid as shard_id
        , nodename as node_name
    FROM pg_dist_shard_placement
)

, order_ids AS (
    SELECT order_id
    FROM orders
    ORDER BY order_id
    LIMIT 5
)

, order_shards AS (
    SELECT 
        order_id
        , get_shard_id_for_distribution_column('orders', order_id) as shard_id
        , 'orders_' || get_shard_id_for_distribution_column('orders', order_id) as real_table_name
    FROM order_ids
)

SELECT
    order_shards.*
    , placement.node_name
FROM order_shards
INNER JOIN placement
    ON placement.shard_id = order_shards.shard_id
;
```

Run `inspect.sh` to get a better overview.
