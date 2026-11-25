# MultiStore | Multipurpose E-Commerce Website

See the [Phase 2 backend and database guide](server/README.md) for setup, API documentation and the database diagram.
See the [Phase 3 authentication guide](server/AUTHENTICATION.md) for account endpoints, administrator initialization and session configuration.
See the [Phase 4 catalog management guide](server/CATALOG_MANAGEMENT.md) for product, category and stock administration.
See the [Phase 5 commerce guide](server/COMMERCE.md) for carts, wishlists, checkout, orders and the inventory transaction rules.
See the [Phase 6 payments guide](server/PAYMENTS.md) for Razorpay Test Mode configuration and reconciliation.
See the [Phase 7 reviews guide](server/REVIEWS.md) and [final testing checklist](TESTING_CHECKLIST.md).

## React + Vite tooling

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.
See the [Phase 8 administration and analytics report](server/ADMIN_ANALYTICS.md) for metric definitions, administrator endpoints, CSV behavior and setup.
