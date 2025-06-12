# Deploying to Render

This document provides instructions for deploying the application to Render.

## Render Configuration

This project uses a `render.yaml` file to define the "Infrastructure as Code". This means that the services, environment variables, and build/start commands are all defined within this file. When you create a new "Blueprint" in Render and connect it to your GitHub repository, Render will automatically detect and use the `render.yaml` file.

## Environment Variables

You will need to configure the following environment variables in the Render dashboard for your service.

-   `DATABASE_URL`: This is automatically provisioned by the Render Postgres database. It is referenced in the `render.yaml` and should not be set manually.
-   `NEXT_PUBLIC_SUPABASE_URL`: The URL for your Supabase project.
-   `NEXT_PUBLIC_SUPABASE_ANON_KEY`: The anonymous key for your Supabase project.
-   `SUPABASE_SERVICE_ROLE_KEY`: The service role key for your Supabase project.
-   `OPENAI_API_KEY`: Your API key for OpenAI.
-   `NEXT_PUBLIC_POSTHOG_KEY`: Your key for PostHog analytics.
-   `NEXT_PUBLIC_POSTHOG_HOST`: The host for PostHog analytics.

**Note:** For local development, you should have a `.env.local` file with these same variables (excluding `DATABASE_URL` if you are using a local Postgres instance).

## Database Migrations

Database migrations are configured to run automatically before any new deployment. This is handled by the `preDeploy` command in the `render.yaml` file, which executes `npx drizzle-kit push`. This ensures your database schema is always up-to-date with the application code.

## Local Development

To run the application locally, you will need to have a `.env.local` file in the root of the project with the environment variables listed above. Then, you can run the application using:

```bash
npm install
npm run dev
``` 