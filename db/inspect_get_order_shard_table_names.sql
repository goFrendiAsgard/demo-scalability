select
    'orders_' || get_shard_id_for_distribution_column('orders', order_id) as real_table_name
from (
    select order_id
    from orders
    order by order_id
    limit 5
) as order_ids
