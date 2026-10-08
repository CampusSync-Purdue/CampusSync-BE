FROM postgres:16-alpine

# Scripts in this directory run only when PostgreSQL initializes a new data volume.
COPY database/init/ /docker-entrypoint-initdb.d/

EXPOSE 5432
