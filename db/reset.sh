#!/bin/bash
docker compose down
sudo rm -Rf citus-db-data citus-healthcheck
docker volume prune