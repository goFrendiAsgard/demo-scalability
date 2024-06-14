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