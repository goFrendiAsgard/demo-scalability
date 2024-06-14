#!/bin/bash

# Initialize variables
MASTER_CONTAINER="${COMPOSE_PROJECT_NAME:-db}_master"
DB_NAME="store"  # Database name
USER_NAME="postgres"  # Username
SQL_FILE="populate.sql"  # SQL file to be executed

# Execute the SQL script
docker exec -i "$MASTER_CONTAINER" psql -U "$USER_NAME" -d "$DB_NAME" < "$SQL_FILE"