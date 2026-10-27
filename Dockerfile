FROM postgres:16-alpine

# Tables are created by drizzle-kit migrations (npm run db:migrate), not by
# initialization scripts.
EXPOSE 5432
