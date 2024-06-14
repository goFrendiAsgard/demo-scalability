from zrb import (
    CmdTask, DockerComposeTask, Task, HTTPChecker, PortChecker, Parallel, Env, runner
)
import os

CURRENT_DIR = os.path.dirname(__file__)
BACKEND_REPLICA = 3
BACKEND_HOSTS = ["localhost" for _ in range(BACKEND_REPLICA)]
BACKEND_PORTS = [f"{3000 + index}" for index in range(1, 1 + BACKEND_REPLICA)]
WORKER_REPLICA = 3
RMQ_CONNECTION = "amqp://user:password@localhost" # This is unsafe, use env var
DB_CONNECTION = "postgresql://postgres@localhost/store"
REDIS_HOST = "localhost"
REDIS_PORT = "6379"

# DB Related Tasks

start_db = DockerComposeTask(
    name="start-db",
    cwd=os.path.join(CURRENT_DIR, "db"),
    checkers=[PortChecker(port=5432)]
)

populate_db = CmdTask(
    name="populate-db",
    cwd=os.path.join(CURRENT_DIR, "db"),
    cmd="./populate.sh"
)

inspect_db = CmdTask(
    name="inspect-db",
    cwd=os.path.join(CURRENT_DIR, "db"),
    cmd="./inspect.sh"
)

# RMQ Related Tasks

start_rabbitmq = DockerComposeTask(
    name="start-rabbitmq",
    cwd=os.path.join(CURRENT_DIR, "rabbitmq"),
    checkers=[
        PortChecker(port=5672),
        HTTPChecker(port=15672)
    ]
)

# Redis Related Tasks

start_redis = DockerComposeTask(
    name="start-redis",
    cwd=os.path.join(CURRENT_DIR, "redis"),
    checkers=[PortChecker(port=6379)]
)

# Backend Related Tasks

prepare_backend = CmdTask(
    name="prepare-backend",
    cwd=os.path.join(CURRENT_DIR, "backend"),
    cmd="npm install",
)

start_backend = Task(name="start-backend")

for index in range(1, 1 + BACKEND_REPLICA):
    start_backend_node = CmdTask(
        name=f"start-backend-{index}",
        envs=[
            Env(name="HTTP_PORT", os_name="", default=f"{3000 + index}"),
            Env(name="SERVER_NAME", os_name="", default=f"SERVER {index}"),
            Env(name="RMQ_CONNECTION", os_name="", default=RMQ_CONNECTION),
            Env(name="DB_CONNECTION", os_name="", default=DB_CONNECTION),
            Env(name="REDIS_HOST", os_name="", default=REDIS_HOST),
            Env(name="REDIS_PORT", os_name="", default=REDIS_PORT),
        ],
        cwd=os.path.join(CURRENT_DIR, "backend"),
        cmd="./start.sh",
        checkers=[HTTPChecker(port=3000 + index)]
    )
    Parallel(start_db, start_redis, start_rabbitmq, prepare_backend) >> start_backend_node >> start_backend

# Worker Related Tasks

prepare_worker = CmdTask(
    name="prepare-worker",
    cwd=os.path.join(CURRENT_DIR, "worker"),
    cmd="npm install",
)

start_worker = Task(name="start-worker")

for index in range(1, 1 + WORKER_REPLICA):
    start_worker_node = CmdTask(
        name=f"start-worker-{index}",
        envs=[
            Env(name="WORKER_NAME", os_name="", default=f"WORKER {index}"),
            Env(name="RMQ_CONNECTION", os_name="", default=RMQ_CONNECTION),
        ],
        cwd=os.path.join(CURRENT_DIR, "worker"),
        cmd="./start.sh",
    )
    Parallel(start_db, start_rabbitmq, prepare_worker) >> start_worker_node >> start_worker

# Load Balancer Related Tasks

prepare_load_balancer = CmdTask(
    name="prepare-load-balancer",
    cwd=os.path.join(CURRENT_DIR, "load-balancer"),
    cmd="npm install",
)

start_load_balancer = CmdTask(
    name="start-load-balancer",
    cwd=os.path.join(CURRENT_DIR, "load-balancer"),
    envs=[
        Env(name="HOSTS", os_name="", default=",".join(BACKEND_HOSTS)),
        Env(name="PORTS", os_name="", default=",".join(BACKEND_PORTS)),
    ],
    cmd="./start.sh",
    checkers=[HTTPChecker(port=3000)]
)
Parallel(prepare_load_balancer, start_backend) >> start_load_balancer

start = Task(name="start")
Parallel(start_db, start_rabbitmq, start_redis, start_backend, start_worker, start_load_balancer) >> start

runner.register(
    start_db,
    populate_db,
    inspect_db,
    start_redis,
    start_rabbitmq,
    start_backend,
    start_worker,
    start_load_balancer,
    start
)
