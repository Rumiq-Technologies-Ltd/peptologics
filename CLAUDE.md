# CLAUDE.md

> Project: PeptoLogics Website
> Framework: Next.js 16
> Language: TypeScript
> UI Library: React
> Styling: Tailwind CSS + shadcn/ui
> Database: Supabase PostgreSQL
> Deployment: Vercel
> AI Assistant: Claude Code
> Version: 1.0
> Last Updated: August 2026

---

# Table of Contents

1. Project Overview
2. Project Principles
3. AI Assistant Operating Rules
4. Development Philosophy
5. Business Goals
6. Technical Stack
7. Repository Standards
8. Git Workflow
9. Coding Standards
10. Architecture
11. Folder Structure
12. Database Design
13. API Design
14. UI / UX Standards
15. Security
16. Performance
17. SEO
18. Accessibility
19. Analytics
20. Testing
21. Environment Variables
22. Development Workflow
23. Deployment
24. Future Scalability
25. Definition of Done

---

# Project Overview

PeptoLogics is a modern, responsive, high-performance lead-generation website built using Next.js 16.

This application is **not** an online payment platform.

Customers will:

- Browse research peptide products.
- View detailed product information.
- Add products to cart.
- Submit an inquiry.
- Receive manual follow-up from company representatives.

Company representatives will:

- Receive inquiries via Email.
- Receive inquiries via WhatsApp.
- Contact customers manually.
- Complete orders outside the website.

The website should maximize trust, simplicity, speed, and conversion.

---

# Mission Statement

The objective of this project is to create a premium-quality website that reflects the professionalism of PeptoLogics while maximizing lead generation and providing an exceptional user experience.

Every engineering decision should improve one or more of the following:

- User Experience
- Performance
- Maintainability
- Scalability
- Reliability
- Security

---

# Project Principles

The following principles override all implementation decisions.

## 1. Simplicity First

Prefer the simplest solution that correctly solves the problem.

Avoid unnecessary abstractions.

Avoid over-engineering.

---

## 2. Readability Over Cleverness

Code is read far more often than it is written.

Optimize for readability.

Future developers should immediately understand the codebase.

---

## 3. Reusability

Avoid duplicated code.

Extract reusable:

- Components
- Hooks
- Utilities
- Services
- Types
- Validation schemas

---

## 4. Scalability

Never implement features that block future growth.

Architecture should support future additions without major refactoring.

Examples:

- Authentication
- Payments
- Inventory
- CRM
- Admin Dashboard
- Order Tracking

---

## 5. Maintainability

Every file should have a single responsibility.

Business logic must remain centralized.

Avoid tightly coupled code.

---

## 6. Performance

Performance is a feature.

Every implementation should consider:

- Bundle size
- Render performance
- Network requests
- Caching
- Image optimization

---

## 7. Accessibility

Accessibility is required.

Never treat accessibility as an optional enhancement.

---

## 8. Security

Every user input must be considered untrusted.

Always validate.

Always sanitize.

Never expose secrets.

---

## 9. Consistency

Maintain consistency across:

- Components
- Styling
- Naming
- APIs
- Error messages
- Validation
- Folder structure

---

# AI Assistant Operating Rules

Claude Code is an engineering assistant.

Claude should behave like a senior software engineer working within an established engineering team.

Claude must prioritize correctness over speed.

---

## Before Writing Code

Always:

1. Read this document.
2. Understand the current architecture.
3. Analyze the requested feature.
4. Explain the implementation plan.
5. Mention trade-offs.
6. Mention potential risks.
7. Wait for approval before major architectural changes.

---

## During Development

Claude should:

- Think before coding.
- Write clean code.
- Avoid unnecessary complexity.
- Reuse existing code whenever possible.
- Avoid duplicate logic.
- Respect existing architecture.

---

## Never Assume Business Logic

If requirements are unclear:

Stop.

Ask questions.

Never invent business rules.

Never guess user expectations.

---

## Existing Code

Never rewrite large portions of existing code unless explicitly instructed.

Prefer incremental improvements.

Avoid introducing breaking changes.

---

## Communication Style

Responses should be:

- Clear
- Technical
- Concise
- Professional

Explain decisions when appropriate.

Do not over-explain obvious concepts.

---

## Decision Making

When multiple implementation options exist:

Claude should:

1. Recommend the best option.
2. Explain why.
3. Mention disadvantages of alternatives.
4. Wait for approval if the decision affects architecture.

---

## Refactoring

Claude may suggest refactoring.

However:

Do not perform significant refactoring automatically.

Always request approval first.

---

## Code Generation

Generated code must always be:

- Production-ready
- Fully typed
- Documented where appropriate
- Consistent
- Readable
- Modular
- Reusable

Placeholder implementations are not acceptable unless specifically requested.

---

## Safety Rules

Never:

- Delete files without approval.
- Remove functionality without approval.
- Rename major folders without approval.
- Change architecture without approval.
- Modify environment variables without approval.
- Expose secrets.
- Disable validation.
- Ignore TypeScript errors.

---

## Documentation

Whenever significant functionality is added:

Update documentation.

If architecture changes:

Update architecture documentation.

---

## Problem Solving Strategy

When debugging:

1. Identify the root cause.
2. Explain the issue.
3. Suggest the smallest safe fix.
4. Consider side effects.
5. Implement only after approval if the fix is significant.

Never hide errors.

Never suppress warnings without explanation.

---

## Development Mindset

Claude should optimize for long-term engineering quality rather than short-term speed.

Every change should improve the overall health of the project.

Technical debt should be minimized whenever practical.

---

# Development Philosophy

This project follows professional software engineering principles.

Quality is preferred over speed.

Correctness is preferred over shortcuts.

Consistency is preferred over personal preference.

Architecture should evolve intentionally rather than accidentally.

The objective is to create a codebase that another senior engineer can understand within minutes.



# Business Goals

## Primary Goals

The primary objective of this project is to generate qualified customer inquiries while providing a premium user experience.

The website should:

- Generate qualified leads
- Increase inquiry submissions
- Build customer trust
- Showcase product quality
- Provide an intuitive browsing experience
- Deliver excellent performance on desktop and mobile
- Minimize user friction during the inquiry process

---

## Secondary Goals

The website should also:

- Rank well on search engines
- Be easy to maintain
- Be easy to scale
- Support future integrations
- Support future e-commerce functionality
- Support future CRM integration
- Support future authentication
- Support future internationalization

---

## Success Metrics

The success of the website should be measured by:

- Inquiry conversion rate
- Product page engagement
- Mobile usability
- Lighthouse performance score
- SEO visibility
- Customer trust signals
- Page loading speed
- Error-free submissions

---

# Technical Stack

The following technologies are the official stack for this project.

Claude must not replace technologies without approval.

## Framework

- Next.js 16
- React 19
- App Router
- TypeScript

---

## Styling

- Tailwind CSS
- shadcn/ui

---

## Forms

- React Hook Form
- Zod

---

## Database

Supabase PostgreSQL

---

## Backend Services

- Supabase
- Next.js Route Handlers

---

## Email

Resend

---

## Notifications

Preferred:

- Meta WhatsApp Cloud API

Alternative:

- Twilio WhatsApp

---

## Hosting

Vercel

---

## Repository

GitHub Organization

---

## Package Manager

Use:

npm

unless instructed otherwise.

---

## Code Quality

Use:

- ESLint
- Prettier
- TypeScript Strict Mode

---

## Icons

Use:

Lucide React

Avoid multiple icon libraries.

---

## Images

Use:

next/image

Avoid regular HTML image tags.

---

## Fonts

Use:

next/font

Do not import fonts manually.

---

# Repository Standards

This repository should remain clean and professional.

## Root Directory

Only essential files should exist in the root.

Examples:

- package.json
- tsconfig.json
- next.config.ts
- README.md
- CLAUDE.md
- .env.example
- .gitignore

Avoid placing random utility files in the project root.

---

## Documentation

Documentation should live inside:

/docs

Examples:

docs/

architecture.md

deployment.md

database.md

api.md

decisions.md

---

## Assets

Static assets belong inside:

public/

Organize assets into folders.

Example:

public/

images/

icons/

logos/

---

## Configuration

Configuration files should remain in the project root.

Examples:

eslint.config.js

prettier.config.js

tailwind.config.ts

tsconfig.json

---

# Git Workflow

This repository follows a professional Git workflow.

The main branch should always remain deployable.

---

## Protected Branch

main

Rules:

- Never commit directly.
- Never force push.
- Never bypass pull requests.

---

## Feature Branches

Each feature should have its own branch.

Examples:

feature/product-list

feature/cart

feature/inquiry-form

feature/email-notifications

feature/seo

---

## Bug Fix Branches

Examples:

fix/mobile-navbar

fix/cart-calculation

fix/email-template

---

## Refactor Branches

Examples:

refactor/product-service

refactor/api-layer

---

## Chore Branches

Examples:

chore/dependencies

chore/eslint

chore/prettier

---

## Experimental Branches

Examples:

experiment/new-search

experiment/product-filters

These branches should never be merged directly into main without review.

---

# Branch Naming Convention

Use lowercase.

Use hyphens.

Good:

feature/product-details

feature/homepage

feature/cart

feature/contact-form

Bad:

Feature1

MyBranch

Testing

newbranch

---

# Commit Standards

Every commit should represent one logical change.

Avoid huge commits.

Commit frequently.

---

## Conventional Commits

Use:

feat:

New feature

Example:

feat: add inquiry form validation

---

fix:

Bug fixes

Example:

fix: prevent duplicate form submissions

---

docs:

Documentation

Example:

docs: update CLAUDE instructions

---

style:

Formatting only

---

refactor:

Internal improvements

---

perf:

Performance improvements

---

test:

Testing

---

chore:

Maintenance

---

build:

Build configuration

---

ci:

CI/CD

---

revert:

Undo previous commits

---

# Commit Rules

Every commit should:

- Be atomic
- Be understandable
- Compile successfully
- Pass linting
- Pass type checking

Avoid:

"update"

"changes"

"fix"

"final"

These messages provide no value.

---

# Pull Requests

Every feature should be submitted through a Pull Request.

Claude should recommend creating a PR after completing a feature.

---

## Pull Request Checklist

Before opening a PR:

- Build succeeds
- TypeScript passes
- ESLint passes
- No console errors
- Mobile tested
- Desktop tested
- Accessibility considered
- Documentation updated
- No duplicate code introduced

---

## Pull Request Description

Each PR should contain:

Summary

Changes Made

Testing Performed

Screenshots (if UI changes)

Breaking Changes

Future Improvements

---

# Code Reviews

Code reviews should focus on:

Correctness

Readability

Maintainability

Performance

Accessibility

Security

Scalability

Consistency

---

# Merge Strategy

Use:

Squash and Merge

unless project requirements change.

Benefits:

- Cleaner Git history
- Easier rollback
- Smaller commit history
- Better readability

---

# Release Philosophy

The main branch should always represent production-ready code.

Incomplete work should never be merged into main.

Features should only be merged after:

- Approval
- Testing
- Successful build
- Code review

---

# Versioning

Follow Semantic Versioning.

MAJOR.MINOR.PATCH

Examples:

1.0.0

1.1.0

1.1.1

Claude should recommend version bumps only when appropriate.

---

# Repository Health

Claude should continuously encourage:

Removing dead code

Removing unused imports

Improving documentation

Reducing duplication

Improving readability

Improving performance

Keeping dependencies updated

Maintaining consistent architecture

Repository quality should improve over time rather than degrade.


# Coding Standards

This project follows strict coding standards to ensure consistency, maintainability, scalability, and readability.

Every line of code should reflect production-quality engineering practices.

---

# General Principles

Always write code that is:

- Simple
- Readable
- Reusable
- Testable
- Scalable
- Strongly Typed
- Maintainable

Optimize for long-term maintainability rather than short-term development speed.

---

# TypeScript Standards

TypeScript is mandatory throughout the project.

## Strict Mode

Always use:

```json
{
  "strict": true
}
```

Never disable TypeScript checks.

---

## Never Use `any`

Avoid `any` completely.

Instead prefer:

- interfaces
- type aliases
- generics
- unknown (when appropriate)

If `any` is absolutely unavoidable:

- Explain why
- Limit its scope
- Never propagate it throughout the application

---

## Prefer Interfaces

Use interfaces for object shapes.

Example:

```ts
interface Product {
  id: string;
  name: string;
  price: number;
}
```

Use type aliases for:

- unions
- mapped types
- utility types

---

## Explicit Types

Avoid unnecessary implicit typing for exported APIs.

Public functions should always have explicit return types.

Example:

```ts
export async function getProducts(): Promise<Product[]> {}
```

---

## Nullable Values

Never assume values exist.

Prefer:

```ts
if (!product) return null;
```

instead of relying on non-null assertions.

Avoid:

```ts
product!.name
```

unless absolutely necessary.

---

# Naming Conventions

Naming should be predictable throughout the entire project.

---

## Components

Use PascalCase.

Good:

ProductCard

CartSidebar

InquiryForm

Bad:

productCard

product_card

---

## Interfaces

Use PascalCase.

Good:

Product

Order

Customer

---

## Types

Use PascalCase.

Good:

OrderStatus

ProductCategory

---

## Enums

Use PascalCase.

Members should be PascalCase.

Example:

```ts
enum OrderStatus {
  New,
  Contacted,
  Confirmed
}
```

---

## Variables

Use camelCase.

Good:

productList

cartItems

customerName

---

## Functions

Use camelCase.

Functions should describe an action.

Good:

calculateSubtotal()

sendInquiryEmail()

createOrder()

filterProducts()

Avoid vague names.

Bad:

run()

data()

process()

handleStuff()

---

## Hooks

Always begin with:

use

Example:

useCart()

useProducts()

useInquiry()

---

## Constants

Global constants should use UPPER_SNAKE_CASE only when they are true constants.

Example:

MAX_CART_ITEMS

API_TIMEOUT

Otherwise use camelCase.

---

## Files

Components:

ProductCard.tsx

InquiryForm.tsx

Hooks:

useCart.ts

useProducts.ts

Utilities:

formatCurrency.ts

calculateSubtotal.ts

Validation:

inquirySchema.ts

---

# Function Design

Functions should perform one responsibility.

If a function becomes difficult to describe in one sentence, it is probably doing too much.

---

## Good Example

```ts
calculateCartSubtotal()

validateInquiry()

createOrder()

sendNotification()
```

---

## Avoid

Functions that:

- validate
- save
- email
- update
- calculate

all in the same function.

---

## Function Length

Aim for:

20–40 lines.

More than 60 lines should trigger consideration for refactoring.

---

## Parameters

Prefer objects instead of many positional parameters.

Good:

```ts
createOrder({
  customer,
  products,
  subtotal
});
```

Avoid:

```ts
createOrder(
  name,
  email,
  phone,
  address,
  city,
  state,
  zip,
  subtotal
);
```

---

# Component Design

Every component should have one responsibility.

Examples:

ProductCard

ProductGrid

HeroSection

Navbar

Footer

Avoid giant components.

---

## Component Size

Prefer:

50–200 lines.

If a component exceeds ~250 lines:

Consider splitting it.

---

## Props

Props should be:

- typed
- minimal
- descriptive

Avoid passing unnecessary data.

Pass only what the component needs.

---

## Component State

Keep state as local as possible.

Avoid unnecessary prop drilling.

If multiple components require shared state:

Consider Context or Zustand.

---

# Business Logic

Business logic must never live inside UI components.

Instead:

Components → Services → Database

Never:

Component → Database

---

# Services

Services contain:

Business rules

Examples:

OrderService

ProductService

NotificationService

Services should not know anything about UI.

---

# Utilities

Utility functions should:

- be pure
- have no side effects
- be reusable

Examples:

formatCurrency()

formatPhone()

slugify()

---

# Custom Hooks

Hooks should encapsulate reusable client-side logic.

Good:

useCart()

useWindowSize()

useDebounce()

Avoid placing business rules inside hooks.

---

# Validation

All validation should use Zod.

Validation schemas belong inside:

src/lib/validations

Avoid duplicate validation logic.

---

# Error Handling

Never silently ignore errors.

Every catch block should:

- log
- return meaningful information
- avoid exposing sensitive details

Example:

```ts
try {

}
catch(error){

 logger.error(error)

 return {
   success:false,
   message:"Unable to submit inquiry."
 }

}
```

---

# Logging

Use structured logging.

Avoid:

```ts
console.log(product)
```

Instead:

```ts
logger.info("Inquiry submitted", {
 customerId,
 orderId
})
```

Production code should not contain unnecessary console statements.

---

# Comments

Prefer self-documenting code.

Comments should explain:

WHY

not

WHAT.

Good:

```ts
// Prevent duplicate inquiry submissions
```

Bad:

```ts
// increment i
i++
```

---

# Magic Numbers

Avoid:

```ts
if(cart.length > 17)
```

Prefer:

```ts
const MAX_CART_ITEMS = 20;
```

---

# Duplication

Follow DRY.

If the same code appears three times:

Extract it.

---

# Early Returns

Prefer:

```ts
if (!customer) return;

if (!cart.length) return;
```

instead of deeply nested conditionals.

---

# Import Order

Maintain a consistent import order.

1. React / Next.js
2. Third-party libraries
3. Internal aliases
4. Relative imports
5. Types
6. Styles

Example:

```ts
import Link from "next/link";

import { z } from "zod";

import { Button } from "@/components/ui/button";

import { formatCurrency } from "@/lib/utils";

import type { Product } from "@/types/product";
```

---

# File Organization

Within files:

1. Imports
2. Types
3. Constants
4. Component
5. Helper functions
6. Exports

Keep the structure consistent across the project.

---

# Code Smells

Claude should actively identify and recommend improvements for:

- Duplicate code
- Large components
- Large functions
- Deep nesting
- Circular dependencies
- Unused imports
- Dead code
- Excessive prop drilling
- Tight coupling
- Poor naming
- Repeated API calls
- Unnecessary client components

---

# Refactoring Rules

Claude may recommend refactoring when it improves:

- readability
- maintainability
- scalability
- performance

However:

Never perform large-scale refactoring without approval.

---

# Quality Checklist

Before considering any task complete, ensure:

- No TypeScript errors
- No ESLint errors
- Strong typing everywhere
- No duplicated logic
- Clear naming
- Reusable code
- Proper validation
- Proper error handling
- Proper loading states
- Proper empty states
- Proper success states
- Responsive layout
- Accessibility maintained



# Next.js 16 Architecture Standards

This project uses **Next.js 16 App Router**.

Claude must follow official Next.js best practices and avoid patterns from the legacy Pages Router unless explicitly requested.

---

# Architecture Philosophy

Build applications that are:

- Server-first
- Fast by default
- SEO-friendly
- Scalable
- Modular
- Type-safe
- Easy to maintain

Favor built-in Next.js features before introducing third-party libraries.

---

# App Router

Always use the App Router.

Application routes belong inside:

src/app/

Example:

src/
└── app/
    ├── layout.tsx
    ├── page.tsx
    ├── products/
    ├── inquiry/
    ├── cart/
    └── api/

Do not use the Pages Router.

---

# Route Organization

Each route should contain only the files it needs.

Example:

products/

page.tsx

loading.tsx

error.tsx

not-found.tsx

components/

Do not create unnecessary nesting.

---

# Layouts

Use layouts to share UI.

Examples:

Navigation

Footer

Theme

Providers

Metadata

Avoid duplicating layout code across pages.

---

# Server Components

Server Components are the default.

Prefer Server Components whenever possible.

Benefits:

- Smaller JavaScript bundles
- Better SEO
- Better performance
- Faster loading

Do not add "use client" unless required.

---

# Client Components

Only use Client Components when necessary.

Examples:

Forms

Search

Dropdowns

Modals

Carousels

Interactive buttons

State management

Browser APIs

Avoid converting entire pages into Client Components.

Keep the client boundary as small as possible.

---

# use client

When required:

Place

"use client"

at the top of the file.

Never place Server-only code inside Client Components.

---

# Data Fetching

Prefer server-side data fetching.

Example:

Server Component

↓

Fetch Data

↓

Render UI

Avoid unnecessary client-side fetching.

---

# Fetch Strategy

When fetching data:

Prefer:

Server Components

↓

Supabase

↓

Render HTML

Avoid:

Client

↓

API

↓

Database

unless interaction requires it.

---

# Loading UI

Every asynchronous route should include:

loading.tsx

Display:

Skeletons

Loading indicators

Placeholder cards

Never leave blank screens.

---

# Error Handling

Every important route should contain:

error.tsx

Provide:

Friendly message

Retry button

Support information

Never expose internal errors.

---

# Not Found

Use:

not-found.tsx

For:

Invalid product

Deleted page

Unknown route

Provide navigation back to the site.

---

# Metadata API

Every page must export metadata.

Include:

Title

Description

Open Graph

Twitter

Canonical URL

Robots

Example:

export const metadata = {

title:

description:

}

Avoid duplicate metadata.

---

# Dynamic Metadata

For product pages:

Generate metadata dynamically.

Example:

Product Name

↓

Page Title

↓

Open Graph

↓

Structured Data

---

# Route Handlers

API routes belong inside:

app/api

Example:

app/api/orders/route.ts

Keep Route Handlers thin.

Business logic belongs inside Services.

---

# Server Actions

Use Server Actions when they provide a simpler and more secure solution than API routes.

Good candidates:

Inquiry form submission

Contact forms

Simple CRUD operations

Avoid overusing them for complex APIs.

---

# Caching

Choose caching intentionally.

Understand:

Static

Dynamic

Revalidated

No Store

Never disable caching without a reason.

---

# Revalidation

When using cached content:

Use revalidation where appropriate.

Avoid unnecessary database requests.

---

# Suspense

Use React Suspense for:

Product grids

Search

Large sections

Improve perceived performance.

---

# Streaming

Stream large pages whenever practical.

Allow users to begin interacting before all content has loaded.

---

# Parallel Data Fetching

Avoid sequential requests.

Prefer:

Promise.all()

when requests are independent.

---

# Dynamic Routes

Example:

products/

[id]/

page.tsx

Keep dynamic routing predictable.

---

# Route Groups

Use Route Groups only when they improve organization.

Avoid unnecessary complexity.

---

# Middleware

Use middleware sparingly.

Appropriate uses:

Authentication

Redirects

Localization

Security headers

Avoid placing business logic inside middleware.

---

# Environment Variables

Access environment variables only on the server unless specifically intended for the client.

Client variables must begin with:

NEXT_PUBLIC_

Never expose secrets.

---

# Images

Always use:

next/image

Benefits:

Optimization

Responsive sizing

Lazy loading

Modern formats

Never use HTML img unless absolutely necessary.

---

# Fonts

Always use:

next/font

Avoid importing fonts manually.

---

# Scripts

Use:

next/script

Choose appropriate loading strategies.

Avoid blocking page rendering.

---

# Navigation

Use:

next/link

Never use standard anchor tags for internal navigation.

---

# Redirects

Prefer:

redirect()

or

permanentRedirect()

Avoid manual window.location navigation.

---

# Forms

Forms should use:

React Hook Form

+

Zod

Validation must occur:

Client

AND

Server

Never rely solely on client validation.

---

# API Responses

All API responses should be typed.

Example:

success

message

data

errors

Maintain a consistent response structure.

---

# Error Boundaries

Use React Error Boundaries where appropriate.

Prevent isolated failures from breaking the entire application.

---

# Search Parameters

Use searchParams appropriately.

Examples:

Filters

Sorting

Pagination

Avoid storing unnecessary UI state in URLs.

---

# Pagination

Design pagination to support:

SEO

Performance

Scalability

Avoid loading large datasets into the client.

---

# File Uploads

If file uploads are introduced:

Validate:

File type

Size

Dimensions (when applicable)

Never trust uploaded files.

---

# State Management

Prefer the simplest solution.

Hierarchy:

Local State

↓

Context

↓

Zustand

↓

Other libraries

Avoid global state unless necessary.

---

# Providers

Keep providers minimal.

Avoid wrapping the entire application unless required.

---

# Accessibility

Every interactive component should support:

Keyboard navigation

Screen readers

Focus states

ARIA labels

Semantic HTML

---

# Performance

Claude should actively optimize:

Bundle size

Hydration

JavaScript shipped

Images

Network requests

Caching

Server rendering

---

# SEO

Every public page should include:

Unique title

Unique description

Canonical URL

Open Graph

Twitter metadata

Structured Data

Robots configuration

---

# Security

Never trust:

Query parameters

Headers

Cookies

Form data

Always validate on the server.

---

# Logging

Unexpected server errors should be logged.

Sensitive information must never be logged.

---

# Production Readiness Checklist

Before implementing a feature, Claude should verify:

✓ Uses Server Components when possible

✓ Client boundary minimized

✓ Metadata implemented

✓ Loading UI exists

✓ Error UI exists

✓ Not Found UI exists

✓ Validation complete

✓ Types complete

✓ Performance considered

✓ Accessibility maintained

✓ SEO maintained

✓ Documentation updated

✓ No unnecessary dependencies added

✓ Architecture remains consistent

# Folder Structure & Project Architecture

This project follows a modular, scalable architecture.

The goal is to make the codebase easy to understand, easy to extend, and easy to maintain.

Every file should have a clear responsibility.

Every folder should represent a logical concern.

Avoid placing unrelated files together.

---

# High-Level Project Structure

```

src/
│
├── app/
├── components/
├── features/
├── services/
├── lib/
├── hooks/
├── store/
├── types/
├── utils/
├── constants/
├── styles/
└── middleware/

```

---

# Architecture Philosophy

Prefer **Feature-Based Architecture** while keeping truly reusable code centralized.

General rule:

```

Feature-specific code
↓

features/

Reusable code
↓

components/
hooks/
utils/
services/

```

---

# app/

The App Router should only contain routing-related files.

Examples:

```

app/

layout.tsx

page.tsx

loading.tsx

error.tsx

not-found.tsx

products/

cart/

inquiry/

api/

```

Do not place business logic inside the app directory.

The app directory should orchestrate pages, not implement business rules.

---

# components/

Contains reusable UI components.

```

components/

ui/

layout/

navigation/

forms/

shared/

feedback/

```

---

## components/ui/

Contains base UI components.

Examples:

```

Button

Input

Badge

Dialog

Card

Tabs

Popover

Tooltip

```

These should be generic and reusable.

Never place business logic here.

---

## components/layout/

Examples:

```

Navbar

Footer

Container

PageHeader

Sidebar

```

---

## components/shared/

Examples:

```

EmptyState

LoadingSpinner

ErrorMessage

SectionHeading

PageTitle

```

Anything reusable across multiple features belongs here.

---

# features/

Every business feature should live here.

Example:

```

features/

products/

cart/

inquiry/

contact/

search/

```

Each feature owns:

- components
- hooks
- services
- validation
- types
- utilities

Example:

```

features/

products/

components/

hooks/

services/

types/

utils/

validation/

```

This keeps features self-contained.

---

# services/

Contains business logic.

Services should never know about React.

Services should never render UI.

Services should never access browser APIs.

Examples:

```

ProductService

OrderService

NotificationService

AnalyticsService

```

Services are responsible for business rules.

---

# lib/

Contains integrations.

Examples:

```

supabase/

resend/

whatsapp/

logger/

validation/

```

External services belong here.

---

# hooks/

Contains reusable hooks.

Examples:

```

useCart()

useMediaQuery()

useDebounce()

usePagination()

```

Hooks should encapsulate reusable logic.

Avoid feature-specific hooks unless they belong inside the feature folder.

---

# store/

Contains global application state.

Only use global state when necessary.

Possible stores:

```

cartStore

themeStore

userStore

```

Prefer local state whenever possible.

---

# utils/

Contains pure utility functions.

Examples:

```

formatCurrency()

formatDate()

generateSlug()

capitalize()

```

Utilities should never depend on React.

---

# constants/

Contains application constants.

Examples:

```

routes.ts

colors.ts

breakpoints.ts

messages.ts

api.ts

```

Avoid magic strings throughout the application.

---

# types/

Contains shared application types.

Examples:

```

Product

Order

Customer

ApiResponse

```

Feature-specific types should remain inside feature folders.

---

# styles/

Contains global styling.

Examples:

```

globals.css

animations.css

variables.css

```

Avoid excessive global styles.

Prefer Tailwind utilities.

---

# middleware/

Contains middleware utilities.

Keep middleware minimal.

---

# Feature Folder Structure

Example:

```

features/

products/

components/

ProductCard.tsx

ProductGrid.tsx

ProductFilters.tsx

services/

product.service.ts

hooks/

useProducts.ts

types/

product.ts

validation/

product.schema.ts

utils/

product.utils.ts

```

Everything related to Products stays together.

---

# Component Organization

Components should remain small.

Avoid giant files.

Preferred hierarchy:

```

Feature

↓

Section

↓

Component

↓

UI Component

```

Example:

```

Products Page

↓

Featured Products

↓

Product Card

↓

Button

Badge

Image

```

---

# Shared Components

Before creating a new component ask:

Can this be reused?

If yes

↓

components/shared

If no

↓

features/{feature}/components

---

# Barrel Exports

Use barrel exports sparingly.

Allowed:

```

index.ts

export * from "./ProductCard";

```

Avoid large barrel files that export the entire project.

---

# Alias Imports

Use path aliases.

Preferred:

```

@/components

@/features

@/lib

@/services

@/hooks

```

Avoid deeply nested relative imports.

Bad:

```

../../../../components

```

---

# File Naming

Components

```

ProductCard.tsx

```

Hooks

```

useCart.ts

```

Utilities

```

formatCurrency.ts

```

Services

```

order.service.ts

```

Validation

```

inquiry.schema.ts

```

Constants

```

routes.ts

```

---

# Co-location

Files that belong together should stay together.

Example:

Product components should not be scattered across the project.

Keep related code nearby.

---

# Dependency Direction

Allowed:

```

UI

↓

Hooks

↓

Services

↓

Database

```

Not Allowed:

```

Database

↓

Components

```

---

# Circular Dependencies

Never create circular imports.

Claude should actively detect them.

---

# Separation of Concerns

Every layer has one responsibility.

UI

↓

Presentation

Hooks

↓

Interaction

Services

↓

Business Logic

Database

↓

Persistence

Never mix these responsibilities.

---

# Component Communication

Prefer:

Props

↓

Context

↓

Global Store

Avoid global state unless necessary.

---

# Data Flow

Always prefer one-way data flow.

Parent

↓

Child

Avoid hidden side effects.

---

# Reusable Business Logic

If business logic is needed in multiple places:

Extract into:

```

services/

or

utils/

```

Never duplicate logic.

---

# Project Organization Rules

Before creating a new file, Claude should ask:

1. Does this already exist?

2. Can this be reused?

3. Does this belong inside a feature?

4. Is this generic?

5. Does this violate separation of concerns?

---

# Architecture Health Checklist

Claude should continuously improve:

✓ Folder organization

✓ Component boundaries

✓ Naming consistency

✓ Reusability

✓ Type safety

✓ Modularity

✓ Scalability

✓ Simplicity

✓ Documentation

✓ Maintainability

Avoid introducing architectural debt.

Every new feature should make the project cleaner—not more complex.

# Database & Supabase Standards

This project uses **Supabase PostgreSQL** as its primary database.

The database is the source of truth for all persistent business data.

Claude should design database interactions to be:

- Secure
- Normalized
- Scalable
- Performant
- Easy to maintain

---

# Database Principles

The database should store business data.

The frontend should display business data.

Business logic should exist inside the application layer—not inside React components.

Never tightly couple UI components to database queries.

---

# Single Source of Truth

Data should exist in one location only.

Avoid duplicated data.

Avoid keeping multiple copies of the same business information.

Whenever possible:

Database

↓

Service Layer

↓

UI

Never:

Database

↓

UI

---

# Database Design Principles

Design tables using normalization.

Avoid storing duplicated information.

Prefer relationships over duplicated columns.

Use foreign keys whenever possible.

---

# Primary Keys

Every table should have:

id

Use UUIDs as primary keys unless another format is explicitly required.

---

# Audit Columns

Every table should contain:

created_at

updated_at

When appropriate:

created_by

updated_by

deleted_at (soft delete)

---

# Timestamp Standards

Always use UTC timestamps.

Never rely on client-side timestamps.

The database should generate timestamps automatically.

---

# Soft Deletes

Avoid permanently deleting important business data.

Prefer:

deleted_at

instead of removing rows.

This allows future recovery and auditing.

---

# Naming Conventions

Tables

Use:

snake_case

Examples:

products

orders

order_items

customers

notifications

---

Columns

Use:

snake_case

Example:

customer_name

created_at

updated_at

product_id

Never use camelCase in database tables.

---

# Products

Products should be stored in the database.

Do not hardcode products inside the application.

A typical Products table may include:

- id
- name
- slug
- description
- category
- strength
- price
- featured
- image_url
- coa_url
- status
- created_at
- updated_at

---

# Orders

The Orders table stores inquiry information.

Suggested columns:

- id
- customer_name
- email
- phone
- address
- apartment
- city
- state
- zip_code
- notes
- subtotal
- status
- created_at
- updated_at

---

# Order Items

Products requested by the customer should be stored separately.

Suggested columns:

- id
- order_id
- product_id
- product_name
- strength
- quantity
- unit_price
- subtotal

Never store order items as a large JSON blob unless there is a specific business requirement.

---

# Status Columns

Use controlled values.

Example:

new

contacted

confirmed

cancelled

completed

Avoid free-text status values.

---

# Lookup Tables

If categories become large:

Create separate lookup tables.

Example:

categories

brands

tags

Avoid repeating strings throughout the database.

---

# Relationships

Always define proper relationships.

Example:

orders

↓

order_items

↓

products

Use foreign keys.

Avoid orphaned records.

---

# Indexing

Add indexes to columns frequently used for:

Searching

Filtering

Sorting

Joining

Examples:

email

slug

status

created_at

category

Avoid unnecessary indexes.

---

# Constraints

Use database constraints whenever possible.

Examples:

NOT NULL

UNIQUE

CHECK

FOREIGN KEY

Never rely solely on frontend validation.

---

# Validation

Validation should happen in multiple layers.

Client

↓

Server

↓

Database

Every layer should protect the next.

---

# Transactions

If multiple writes must succeed together:

Use database transactions.

Example:

Create Order

↓

Create Order Items

↓

Create Notifications

If one fails:

Rollback everything.

---

# Query Design

Prefer smaller focused queries.

Avoid SELECT *

Only fetch required columns.

---

# Pagination

Large tables should always support pagination.

Avoid loading hundreds of records at once.

---

# Searching

Searching should occur inside the database whenever practical.

Avoid downloading large datasets and filtering in React.

---

# Sorting

Sorting should be performed by SQL whenever possible.

Avoid sorting thousands of records in the browser.

---

# Filtering

Filtering should happen in database queries.

Avoid unnecessary client-side filtering.

---

# Database Functions

Avoid putting business logic into PostgreSQL functions unless there is a strong performance or security reason.

Business logic belongs inside the application service layer.

---

# Migrations

All schema changes must use migrations.

Never manually edit production databases.

Every migration should be:

- reversible where practical
- documented
- reviewed

---

# Seed Data

Development seed data should live separately from production data.

Example:

supabase/

├── migrations/

├── seed.sql

Avoid mixing test data with production data.

---

# Row Level Security (RLS)

If authentication is added in the future:

Enable Row Level Security.

Create explicit policies.

Never rely on frontend restrictions for security.

---

# Secrets

Never store:

API Keys

Tokens

Passwords

Secrets

inside database tables.

---

# Images

Store image URLs.

Do not store image binaries inside PostgreSQL.

Use Supabase Storage or another object storage service.

---

# File Storage

Use Supabase Storage for:

Images

Certificates

Documents

Future uploads

Avoid storing files inside database rows.

---

# Repository Pattern

Database queries should be centralized.

Recommended flow:

UI

↓

Service

↓

Repository

↓

Supabase

↓

Database

This keeps database logic isolated.

---

# Error Handling

Database errors should:

- be logged
- return friendly user messages
- never expose SQL errors
- never expose internal table names

---

# Performance

Avoid:

N+1 queries

Repeated queries

Duplicate requests

Unused joins

Prefer efficient SQL.

---

# Data Integrity

Claude should prioritize:

Consistency

Correctness

Normalization

Referential Integrity

Scalability

Never sacrifice data integrity for convenience.

---

# Database Documentation

Every new table should include documentation for:

Purpose

Relationships

Constraints

Indexes

Business rules

---

# Future Compatibility

The schema should support future additions without major redesign.

Potential future modules include:

- Authentication
- User Accounts
- Admin Dashboard
- Inventory
- Order Tracking
- CRM
- Product Reviews
- Coupons
- Blog
- Affiliate System
- Multi-language Support

Design today's schema so tomorrow's features fit naturally.

---

# Database Quality Checklist

Before creating or modifying a table, verify:

✓ Proper primary key

✓ Proper foreign keys

✓ Proper indexes

✓ Proper constraints

✓ UTC timestamps

✓ Audit columns

✓ Normalized design

✓ No duplicated data

✓ Scalable relationships

✓ Migration created

✓ Documentation updated

✓ Business rules preserved


# API & Service Layer Standards

The application must follow a layered architecture.

Every layer has one responsibility.

Never mix responsibilities.

---

# Architecture Overview

The preferred flow is:

```
Browser
    │
    ▼
React Components
    │
    ▼
Custom Hooks (optional)
    │
    ▼
Service Layer
    │
    ▼
Repository Layer
    │
    ▼
Supabase
    │
    ▼
PostgreSQL
```

The UI should never communicate directly with the database.

---

# Responsibility of Each Layer

## UI Layer

Responsible for:

- Rendering
- User interaction
- Loading states
- Error states
- Success messages
- Accessibility

The UI must never:

- Query the database
- Send emails
- Validate business rules
- Calculate business logic

---

## Hook Layer

Hooks encapsulate reusable client-side behavior.

Examples:

- Form handling
- Debouncing
- Pagination
- Search state
- Responsive behavior

Hooks should not contain business rules.

---

## Service Layer

The Service Layer contains business logic.

Examples:

```
ProductService

OrderService

NotificationService

InquiryService
```

The service decides **what should happen**.

Example:

Customer submits inquiry

↓

Validate

↓

Create order

↓

Create order items

↓

Send email

↓

Send WhatsApp notification

↓

Return success

---

## Repository Layer

Repositories communicate with the database.

They should:

- Fetch
- Insert
- Update
- Delete

Nothing else.

Avoid placing business decisions inside repositories.

---

# API Route Responsibilities

API routes should remain extremely small.

Typical flow:

```
Receive Request

↓

Validate Request

↓

Call Service

↓

Return Response
```

Avoid writing business logic inside API routes.

---

# Route Structure

```
app/
└── api/
    ├── inquiries/
    │   └── route.ts
    ├── products/
    │   └── route.ts
    └── health/
        └── route.ts
```

Keep endpoints organized by resource.

---

# API Naming

Use plural resource names.

Good:

```
/api/products

/api/orders

/api/inquiries
```

Avoid:

```
/api/getProducts

/api/createOrder

/api/sendEmail
```

Use HTTP methods instead.

---

# HTTP Methods

GET

Retrieve resources

POST

Create resources

PUT

Replace resources

PATCH

Update resources

DELETE

Remove resources

Use the correct HTTP verb.

---

# Response Format

Every endpoint should return a consistent structure.

Example:

```ts
{
  success: true,
  message: "Inquiry submitted successfully.",
  data: { ... }
}
```

Error example:

```ts
{
  success: false,
  message: "Validation failed.",
  errors: [...]
}
```

Consistency is more important than personal preference.

---

# Validation

Every request must be validated.

Use Zod schemas.

Validation should occur before calling services.

Never trust incoming data.

---

# Error Handling

Every API route should:

- Catch unexpected errors
- Log errors
- Return safe messages

Never expose:

- Stack traces
- SQL queries
- Internal paths
- Secrets

---

# Business Rules

Business rules belong inside services.

Examples:

- Maximum cart size
- Product availability
- Inquiry limits
- Duplicate submissions
- Notification logic

Do not implement these rules inside components or API routes.

---

# Dependency Injection

Prefer passing dependencies into services when practical.

Example:

```ts
new OrderService(orderRepository, emailService)
```

Avoid creating dependencies directly inside methods when it makes testing difficult.

---

# External Services

External integrations should be wrapped in dedicated services.

Examples:

```
EmailService

WhatsAppService

AnalyticsService

StorageService
```

The rest of the application should not know implementation details.

---

# Notifications

Email and WhatsApp notifications should be independent.

Failure to send one notification should not corrupt the order itself.

Example:

Order created

↓

Email fails

↓

Retry notification

↓

Order remains saved

---

# Retry Strategy

Temporary external failures should support retries.

Examples:

- Email provider timeout
- WhatsApp API unavailable
- Network interruption

Do not retry validation failures.

---

# Idempotency

Creating an inquiry should be idempotent where practical.

Prevent accidental duplicate submissions caused by double-clicking or network retries.

---

# Timeouts

All external service calls should use reasonable timeouts.

Avoid waiting indefinitely for third-party APIs.

---

# Rate Limiting

Protect public endpoints.

Examples:

- Inquiry form
- Contact form
- Future authentication endpoints

Rate limiting helps prevent spam and abuse.

---

# API Versioning

If public APIs are introduced in the future, version them.

Example:

```
/api/v1/products
```

Avoid breaking existing consumers.

---

# Logging

Log important business events.

Examples:

- Inquiry created
- Email sent
- WhatsApp sent
- Validation failed

Never log sensitive personal information unnecessarily.

---

# Observability

Design services so failures can be diagnosed.

Prefer structured logs over plain text.

Include correlation IDs where appropriate for tracing requests.

---

# Service Naming

Use descriptive names.

Examples:

```
ProductService

OrderService

NotificationService

CustomerService
```

Avoid vague names such as:

```
Manager

Helper

Processor

Handler
```

---

# Repository Naming

Examples:

```
ProductRepository

OrderRepository

CustomerRepository
```

Repositories should represent a single data source.

---

# Async Operations

All asynchronous functions should:

- Handle failures
- Return predictable types
- Avoid unhandled promise rejections

Use async/await instead of chained `.then()` calls unless there is a compelling reason.

---

# API Documentation

Every endpoint should document:

- Purpose
- Request format
- Response format
- Validation rules
- Error responses
- Authentication requirements (if applicable)

Keep documentation updated when endpoints change.

---

# Health Endpoint

Provide a simple health endpoint for monitoring.

Example:

```
GET /api/health
```

It should confirm that the application is running and, if appropriate, verify connectivity to essential dependencies without exposing sensitive information.

---

# API Quality Checklist

Before completing any endpoint, verify:

✓ Input validated

✓ Business logic in services

✓ Database access isolated

✓ Consistent response format

✓ Errors handled safely

✓ Sensitive data protected

✓ Logging implemented

✓ Typed request/response

✓ Documentation updated

✓ No duplicated logic

✓ No business logic inside UI

# UI / UX Design Standards

The user interface should communicate professionalism, trust, and simplicity.

Every page should feel fast, clean, and intuitive.

Visual consistency is more important than visual complexity.

---

# Design Philosophy

The website should reflect a premium healthcare and research brand.

Users should immediately feel:

- Trust
- Professionalism
- Clarity
- Quality
- Reliability

Avoid flashy effects that distract from the primary goal of generating inquiries.

---

# Design Principles

Every interface should prioritize:

- Clarity over decoration
- Simplicity over complexity
- Readability over density
- Consistency over novelty
- Accessibility over aesthetics

---

# Mobile First

Design for mobile first.

Desktop layouts should enhance the mobile experience rather than redefine it.

Every new component should be reviewed at:

- Mobile
- Tablet
- Desktop

---

# Responsive Layout

Support at least the following breakpoints:

- Mobile
- Tablet
- Laptop
- Desktop
- Large Desktop

Avoid fixed widths whenever possible.

Prefer flexible layouts using CSS Grid and Flexbox.

---

# Layout

Use consistent page spacing.

Example layout hierarchy:

```
Header

↓

Hero

↓

Content Sections

↓

CTA

↓

Footer
```

Maintain predictable spacing between sections.

---

# Container Width

Use a consistent maximum content width across the application.

Avoid pages where content stretches the full width on large monitors.

---

# White Space

Generous spacing improves readability.

Do not overcrowd interfaces.

Allow sections room to breathe.

---

# Typography

Use:

**Inter**

Headings:

- Bold
- High contrast
- Consistent sizing

Body text:

- Regular weight
- Comfortable line height
- Easy to scan

Avoid excessive font weights or decorative fonts.

---

# Color System

Primary Blue

```
#1D4ED8
```

Dark Navy

```
#0F172A
```

Background

```
#F8FAFC
```

Text

```
#111827
```

Use semantic colors for success, warning, and error states.

Do not hardcode colors inside components.

Prefer Tailwind theme tokens or design tokens.

---

# Buttons

Buttons should have clear hierarchy.

Primary

- Main CTA
- High emphasis

Secondary

- Supporting actions

Ghost

- Low emphasis

Destructive

- Dangerous actions

Avoid creating unnecessary button variants.

---

# Cards

Cards should have consistent:

- Border radius
- Padding
- Shadow
- Hover behavior
- Typography

Avoid inconsistent card designs between pages.

---

# Forms

Forms should be:

- Short
- Clear
- Easy to complete

Each field should include:

- Label
- Placeholder (when helpful)
- Validation message
- Accessible description (if needed)

Never rely solely on placeholder text as the label.

---

# Form Validation

Validation should be:

- Immediate when appropriate
- Helpful
- Specific

Bad:

```
Invalid input.
```

Good:

```
Please enter a valid email address.
```

Never expose technical validation messages to users.

---

# Loading States

Every asynchronous action should provide visual feedback.

Examples:

- Skeleton loaders
- Loading buttons
- Progress indicators

Avoid blank screens while waiting for data.

---

# Empty States

Every list or search should have an intentional empty state.

Examples:

- No products found
- Cart is empty
- No search results

Provide guidance for what users can do next.

---

# Error States

Error messages should:

- Explain what happened
- Suggest a next step
- Avoid technical jargon

Whenever possible, provide a retry option.

---

# Success States

Celebrate successful actions subtly.

Examples:

- Inquiry submitted successfully
- Product added to cart

Avoid intrusive popups for routine success messages.

---

# Navigation

Navigation should be simple and predictable.

Primary navigation should include:

- Home
- Products
- Contact (if applicable)

Highlight the active page.

Ensure navigation is keyboard accessible.

---

# Calls to Action (CTA)

Every page should have a clear primary CTA.

Examples:

- Browse Products
- Request Information
- Submit Inquiry

Avoid competing primary actions on the same screen.

---

# Product Cards

Each product card should present:

- Product image
- Product name
- Strength
- Price
- Short description (optional)
- Featured badge (if applicable)
- Add to Cart button

Keep layouts consistent across all cards.

---

# Images

Images should be:

- High quality
- Optimized
- Consistent in aspect ratio

Use meaningful alt text.

Avoid decorative images that add no value.

---

# Icons

Use a single icon library throughout the application.

Preferred:

Lucide React

Icons should support—not replace—text labels.

---

# Animations

Animations should be subtle and purposeful.

Examples:

- Hover effects
- Fade-in transitions
- Loading indicators

Avoid excessive motion.

Respect users who prefer reduced motion.

---

# Accessibility

Every interactive element should support:

- Keyboard navigation
- Visible focus states
- Screen readers
- Appropriate ARIA attributes
- Semantic HTML

Color should never be the only indicator of meaning.

---

# Trust Signals

The interface should reinforce trust by displaying:

- Company contact information
- Response time expectations
- Product transparency
- Laboratory testing information (if available)
- Secure inquiry messaging

Trust should be visible throughout the customer journey.

---

# Consistency

Maintain consistency across:

- Typography
- Colors
- Spacing
- Icons
- Buttons
- Cards
- Forms
- Headings
- Page layouts

Users should never feel like different pages belong to different websites.

---

# User Journey

Optimize the primary flow:

Home

↓

Browse Products

↓

Add to Cart

↓

Inquiry

↓

Success Confirmation

Reduce unnecessary steps wherever possible.

---

# Accessibility & UX Checklist

Before completing a feature, verify:

✓ Responsive on all target screen sizes

✓ Keyboard accessible

✓ Focus states visible

✓ Semantic HTML used

✓ Forms clearly labeled

✓ Validation messages helpful

✓ Loading state implemented

✓ Empty state implemented

✓ Error state implemented

✓ Success state implemented

✓ Images optimized

✓ Alt text provided

✓ Primary CTA clear

✓ Consistent spacing

✓ Consistent typography

✓ Meets WCAG 2.1 AA requirements


# Security Standards

Security is a core requirement of this project.

Every feature should be designed with security in mind from the beginning.

Never sacrifice security for convenience.

---

# Security Principles

Every request should follow the principle:

Never Trust User Input.

Assume that every request may contain:

- Invalid data
- Malicious input
- Automated spam
- SQL injection attempts
- XSS payloads
- Invalid files
- Unexpected values

Every layer must validate incoming data.

---

# Defense in Depth

Validation should occur at multiple layers.

```
Client

↓

Server

↓

Database
```

Never rely on a single layer.

---

# Input Validation

Every request must be validated.

Use:

Zod

Validation should verify:

- Required fields
- Email format
- Phone format
- String lengths
- Numeric ranges
- Allowed values
- Enum values

Never trust frontend validation alone.

---

# Input Sanitization

Before storing or processing data:

Sanitize user input.

Protect against:

- HTML injection
- Script injection
- Unexpected whitespace
- Invalid Unicode
- Control characters

---

# Output Encoding

Never render raw user-generated HTML.

Prefer plain text rendering.

If HTML rendering is ever required:

Use a trusted sanitization library.

---

# SQL Injection

Always use parameterized queries.

Never build SQL using string concatenation.

Bad:

```ts
`SELECT * FROM orders WHERE email='${email}'`
```

Good:

Use the Supabase client or parameterized queries.

---

# Cross-Site Scripting (XSS)

Never insert unsanitized user content into the DOM.

Avoid:

- dangerouslySetInnerHTML

Unless absolutely necessary.

If unavoidable:

Sanitize first.

---

# Cross-Site Request Forgery (CSRF)

When authenticated functionality is introduced:

Implement CSRF protection where applicable.

Do not assume browser behavior is sufficient.

---

# Authentication

Authentication is not part of the initial release.

Future authentication should support:

- Secure sessions
- Password hashing
- Email verification
- Password reset
- Multi-factor authentication (future)

Never store plaintext passwords.

---

# Authorization

Always verify permissions on the server.

Never rely on frontend checks.

The frontend controls visibility.

The backend controls access.

---

# Secrets

Never expose:

- API Keys
- Database credentials
- Service role keys
- Webhook secrets
- Access tokens
- Private URLs

Secrets belong only in environment variables.

---

# Environment Variables

Server secrets must never be accessed in client-side code.

Only public variables should use:

```
NEXT_PUBLIC_
```

Review new environment variables before adding them.

---

# Rate Limiting

Protect all public submission endpoints.

Examples:

- Inquiry form
- Contact form
- Future authentication

Prevent:

- Spam
- Abuse
- Brute-force attempts

---

# Spam Protection

Implement protection for public forms.

Preferred options include:

- Rate limiting
- Honeypot fields
- CAPTCHA (if abuse becomes significant)

Choose the least intrusive solution that effectively reduces spam.

---

# File Upload Security

If file uploads are added:

Validate:

- File type
- File size
- MIME type

Reject executable files.

Never trust file extensions alone.

---

# HTTPS

All production traffic must use HTTPS.

Never send sensitive information over HTTP.

---

# Cookies

If cookies are introduced:

Use:

- Secure
- HttpOnly (when appropriate)
- SameSite

Avoid storing sensitive information in client-accessible cookies.

---

# Logging

Log:

- Errors
- Important business events
- Security events

Never log:

- Passwords
- Secrets
- API Keys
- Payment information
- Authentication tokens

Be mindful when logging personal information.

---

# Error Messages

Users should receive friendly messages.

Developers should receive detailed logs.

Bad:

```
Supabase Error:
relation "orders" does not exist
```

Good:

```
Unable to process your request.

Please try again.
```

---

# Email Security

Validate all email addresses.

Never allow email header injection.

Escape user content included in email templates.

---

# API Security

Every endpoint should:

- Validate input
- Handle errors safely
- Return typed responses
- Avoid leaking implementation details

Do not expose internal stack traces.

---

# CORS

Restrict Cross-Origin Resource Sharing to trusted origins.

Avoid using overly permissive configurations in production.

---

# Dependency Security

Keep dependencies updated.

Remove unused packages.

Before introducing a new package:

- Evaluate maintenance
- Review popularity
- Check licensing
- Consider bundle size
- Prefer built-in platform features when possible

---

# Principle of Least Privilege

Every service should receive only the permissions it requires.

Avoid granting unnecessary access.

---

# Backups

Database backups should be automated.

Test restoration procedures periodically.

A backup is only useful if it can be restored.

---

# Monitoring

Monitor:

- Application errors
- Failed submissions
- External service failures
- Database health
- Performance metrics

Alerts should be actionable.

---

# Security Reviews

Before releasing a feature, verify:

✓ All input validated

✓ User input sanitized

✓ No secrets exposed

✓ Environment variables reviewed

✓ Friendly error messages returned

✓ Logging does not expose sensitive information

✓ Rate limiting considered

✓ HTTPS required

✓ Dependencies reviewed

✓ No unnecessary permissions granted

Security should be part of every feature—not an afterthought.


# Performance & SEO Standards

Performance and Search Engine Optimization (SEO) are first-class requirements.

A fast website improves:

- User experience
- Conversion rates
- Search rankings
- Accessibility
- Customer trust

Every feature should be evaluated for its impact on performance.

---

# Performance Philosophy

Build for performance by default.

Avoid fixing performance problems after development.

Every implementation should consider:

- JavaScript bundle size
- Network requests
- Image optimization
- Rendering strategy
- Caching
- Third-party scripts

---

# Performance Targets

Target Lighthouse Score:

- Performance: ≥ 95
- Accessibility: ≥ 95
- Best Practices: ≥ 95
- SEO: ≥ 95

Core Web Vitals targets:

- LCP < 2.5s
- CLS < 0.1
- INP < 200ms

These are goals, not guarantees, but they should guide implementation decisions.

---

# Rendering Strategy

Prefer Server Components whenever possible.

Use Client Components only when interactivity requires them.

Choose rendering intentionally:

- Static Rendering for stable content
- Dynamic Rendering for request-specific content
- Incremental Static Regeneration (ISR) when content updates periodically

Avoid making pages dynamic without a clear reason.

---

# Data Fetching

Fetch data on the server whenever practical.

Avoid unnecessary client-side requests.

If multiple independent requests are required:

Use parallel fetching.

Avoid waterfall requests.

---

# Caching

Use caching intentionally.

Examples:

- Static assets
- Product listings (where appropriate)
- Images
- Metadata

Document caching decisions when they are not obvious.

---

# Images

Always use:

next/image

Requirements:

- Responsive sizing
- Lazy loading where appropriate
- Modern formats (WebP / AVIF when available)
- Meaningful alt text

Avoid oversized images.

Optimize assets before adding them to the project.

---

# Fonts

Use:

next/font

Self-host fonts whenever practical.

Avoid blocking page rendering with font loading.

---

# JavaScript

Ship the minimum amount of JavaScript required.

Avoid large client bundles.

Remove unused code.

Prefer code splitting for large features.

---

# Third-Party Libraries

Before adding a dependency, ask:

1. Can Next.js already solve this?
2. Can the browser solve this?
3. Is the dependency actively maintained?
4. Is the bundle size acceptable?

Prefer fewer dependencies over convenience.

---

# Third-Party Scripts

Use `next/script`.

Load scripts with the appropriate strategy.

Delay non-critical scripts until after the page becomes interactive.

Avoid unnecessary tracking scripts.

---

# Network Requests

Minimize HTTP requests.

Avoid duplicate requests.

Batch requests where practical.

Retry only when appropriate.

---

# Loading States

Every asynchronous operation should display meaningful loading feedback.

Examples:

- Skeleton loaders
- Loading buttons
- Placeholder cards

Avoid layout shifts during loading.

---

# Code Splitting

Lazy-load heavy or infrequently used components.

Examples:

- Large charts
- Rich text editors
- Admin-only features
- Modals opened on demand

Do not lazy-load critical above-the-fold content.

---

# SEO Philosophy

Every public page should be discoverable, understandable, and indexable by search engines.

SEO should be built into the architecture—not added later.

---

# Metadata

Every page must provide:

- Title
- Description
- Canonical URL
- Open Graph metadata
- Twitter Card metadata

Avoid duplicate titles and descriptions.

---

# Structured Data

Use Schema.org structured data where appropriate.

Examples:

- Organization
- Product
- Breadcrumb
- FAQ (if applicable)

Ensure structured data matches visible page content.

---

# Canonical URLs

Specify canonical URLs for indexable pages.

Avoid duplicate content caused by multiple URLs serving the same page.

---

# Open Graph

Provide rich previews for social sharing.

Include:

- Title
- Description
- Image
- URL

Use high-quality preview images.

---

# Robots

Use robots directives intentionally.

Do not accidentally block important pages.

Keep staging environments out of search indexes.

---

# Sitemap

Generate and maintain an XML sitemap.

Update it when new public pages are added.

---

# Breadcrumbs

Provide breadcrumb navigation where it improves usability.

Ensure breadcrumb structured data matches the visible breadcrumbs.

---

# URLs

Use readable, descriptive URLs.

Good:

```
/products/retatrutide-10mg
```

Avoid:

```
/product?id=123
```

Keep URLs stable.

---

# Heading Structure

Each page should have one primary H1.

Use H2–H6 hierarchically.

Do not skip heading levels without reason.

Headings should describe the page structure, not just styling.

---

# Internal Linking

Link related content naturally.

Examples:

- Product pages to inquiry page
- Home page to featured products
- Product categories to products

Internal links improve navigation and SEO.

---

# Accessibility & SEO

Accessibility improvements often benefit SEO.

Use:

- Semantic HTML
- Descriptive headings
- Alt text
- Accessible navigation

Avoid using generic link text such as:

```
Click here
```

Prefer descriptive text.

---

# Analytics

Implement Google Analytics 4.

Track key business events:

- Product Viewed
- Product Added to Cart
- Inquiry Started
- Inquiry Submitted

Avoid collecting unnecessary personal information.

---

# Monitoring

Monitor:

- Core Web Vitals
- Lighthouse scores
- Crawl errors
- Broken links
- Page performance

Review metrics periodically after deployment.

---

# Performance & SEO Checklist

Before completing a feature, verify:

✓ Server Components used where possible

✓ Client JavaScript minimized

✓ Images optimized

✓ Fonts optimized

✓ Metadata complete

✓ Structured data implemented (where appropriate)

✓ Canonical URL defined

✓ Open Graph configured

✓ Loading state implemented

✓ No unnecessary network requests

✓ Accessibility maintained

✓ Core Web Vitals considered

✓ Analytics events reviewed

✓ Lighthouse targets considered

Performance and SEO should be treated as ongoing engineering responsibilities rather than one-time tasks.


# Testing & Quality Assurance Standards

Quality is not achieved through testing alone.

Quality begins with good architecture, strong typing, clear requirements, and disciplined implementation.

Testing verifies quality—it does not create it.

Every feature should be designed to be testable.

---

# Testing Philosophy

The objective is to prevent bugs before they reach production.

Testing should provide confidence, not just coverage.

Avoid writing tests simply to increase coverage percentages.

Focus on testing behavior rather than implementation details.

---

# Testing Pyramid

Follow the testing pyramid.

```
            E2E Tests
         ----------------
       Integration Tests
    -----------------------
         Unit Tests
```

Prioritize fast, reliable tests.

---

# Recommended Tools

Unit Testing

- Vitest

Component Testing

- React Testing Library

End-to-End Testing

- Playwright

Avoid introducing multiple testing frameworks without a clear benefit.

---

# Unit Testing

Unit tests should verify isolated business logic.

Good candidates:

- Utility functions
- Validation schemas
- Service methods
- Pricing calculations
- Cart calculations
- Formatters

Example:

```
calculateSubtotal()

↓

Expected Result
```

---

# Component Testing

Test components from the user's perspective.

Verify:

- Rendering
- User interaction
- Accessibility
- Validation
- Error messages

Avoid testing implementation details such as internal state.

---

# Integration Testing

Integration tests verify that multiple components work together.

Examples:

Inquiry Form

↓

Validation

↓

API

↓

Database

↓

Success Response

The goal is to verify interactions between layers.

---

# End-to-End Testing

E2E tests should cover critical user journeys.

Examples:

Home

↓

Browse Products

↓

Add to Cart

↓

Inquiry

↓

Success

Other scenarios:

- Search products
- Filter products
- Invalid form submission
- Empty cart
- Error handling

---

# Business Logic Testing

Critical business rules should always be tested.

Examples:

- Cart subtotal calculation
- Product quantity validation
- Inquiry submission rules
- Order status transitions

Business logic should not rely solely on manual testing.

---

# Validation Testing

Verify:

- Required fields
- Invalid emails
- Invalid phone numbers
- Missing products
- Empty cart
- Maximum lengths
- Minimum lengths

Validation should behave consistently on both client and server.

---

# Error Handling Tests

Verify:

- Network failures
- Database failures
- Email failures
- WhatsApp failures
- Invalid requests

Applications should fail gracefully.

---

# Accessibility Testing

Verify:

- Keyboard navigation
- Focus order
- Screen reader compatibility
- Labels
- Contrast
- Semantic HTML

Accessibility should be part of regular testing—not a final review.

---

# Responsive Testing

Test at common viewport sizes.

Minimum:

- Mobile
- Tablet
- Desktop

Verify layouts remain usable across breakpoints.

---

# Browser Compatibility

Test modern versions of:

- Chrome
- Edge
- Firefox
- Safari

Focus on supported browsers defined by project requirements.

---

# Performance Testing

Review:

- Lighthouse
- Core Web Vitals
- Bundle size
- Hydration
- Image optimization

Testing should identify regressions early.

---

# Regression Testing

When fixing a bug:

1. Verify the fix.
2. Verify related functionality.
3. Add or update tests if appropriate.

Avoid fixing one issue while introducing another.

---

# Mocking

Mock external dependencies when appropriate.

Examples:

- Email provider
- WhatsApp API
- Analytics
- Third-party services

Do not mock the functionality being tested.

---

# Test Data

Keep test data:

- Minimal
- Predictable
- Readable

Avoid large, difficult-to-maintain fixtures.

---

# Deterministic Tests

Tests should produce the same result every time.

Avoid dependencies on:

- Current time (unless controlled)
- Random values
- External APIs
- Network availability

---

# Continuous Testing

Run the following before merging:

- Type checking
- Linting
- Unit tests
- Integration tests (where available)

Treat failing tests as blockers.

---

# Manual Testing Checklist

Before approving a feature:

✓ Feature works as expected

✓ Responsive layout verified

✓ Keyboard navigation verified

✓ Loading state verified

✓ Empty state verified

✓ Error state verified

✓ Success state verified

✓ Validation verified

✓ Console free of unexpected errors

✓ No obvious visual regressions

---

# Bug Reporting

When documenting a bug, include:

- Title
- Environment
- Preconditions
- Steps to Reproduce
- Expected Result
- Actual Result
- Severity
- Priority
- Screenshots or recordings (if applicable)

Clear bug reports reduce debugging time.

---

# Code Coverage

Aim for meaningful coverage rather than arbitrary percentages.

High-value areas should receive higher testing priority than simple UI wrappers.

Coverage should support confidence—not become the goal itself.

---

# Definition of Test Completion

A feature should be considered sufficiently tested when:

✓ Business logic behaves correctly

✓ User flows succeed

✓ Validation behaves correctly

✓ Errors are handled gracefully

✓ Accessibility has been reviewed

✓ Responsive behavior verified

✓ No critical regressions identified

✓ Automated tests updated where appropriate

Testing should increase confidence in every release.


# Deployment & DevOps Standards

Deployment should be predictable, repeatable, and safe.

Every deployment should be capable of reaching production without requiring manual code changes.

The deployment process should be automated wherever practical.

---

# Deployment Philosophy

The deployment pipeline should provide confidence.

A successful deployment means:

- Code builds successfully
- Type checking passes
- Linting passes
- Environment variables exist
- Production behaves as expected

Deployment should never be used as a testing environment.

---

# Source Control

The GitHub repository is the single source of truth.

All production code must originate from GitHub.

Never deploy code that exists only on a local machine.

---

# Branch Strategy

Protected Branch

```
main
```

Development Branch

```
develop
```

Feature Branches

```
feature/product-page

feature/cart

feature/inquiry-form

feature/email-notifications
```

Bug Fixes

```
fix/mobile-navbar

fix/form-validation
```

Hotfixes

```
hotfix/email-timeout
```

---

# Branch Workflow

```
main
        │
        ▼
develop
        │
        ▼
feature/*
        │
        ▼
Pull Request
        │
        ▼
develop
        │
        ▼
Production Release
        │
        ▼
main
```

Never develop directly on `main`.

---

# Pull Requests

Every feature must be submitted through a Pull Request.

A Pull Request should contain:

- Summary
- Screenshots (for UI changes)
- Testing completed
- Known limitations
- Related issue (if applicable)

Pull Requests should remain focused on a single logical change.

---

# Code Review

Every Pull Request should be reviewed before merging.

Review focus:

- Correctness
- Readability
- Maintainability
- Security
- Performance
- Accessibility
- Architecture

Avoid approving code that introduces technical debt without discussion.

---

# Merge Strategy

Preferred merge method:

```
Squash and Merge
```

Benefits:

- Clean Git history
- Easier rollbacks
- Simpler release notes

---

# Environment Configuration

Maintain separate environment configurations for:

Development

Staging (if introduced)

Production

Never reuse production secrets in development.

---

# Environment Variables

Maintain an `.env.example` file.

It should include every required environment variable without secret values.

Example:

```
NEXT_PUBLIC_SITE_URL=

NEXT_PUBLIC_SUPABASE_URL=

NEXT_PUBLIC_SUPABASE_ANON_KEY=

SUPABASE_SERVICE_ROLE_KEY=

RESEND_API_KEY=

WHATSAPP_ACCESS_TOKEN=
```

Do not commit `.env.local`.

---

# Build Verification

Before merging, verify:

```
npm run lint

npm run typecheck

npm run build
```

All commands must complete successfully.

A build failure blocks deployment.

---

# Dependency Management

Keep dependencies current.

When updating dependencies:

- Review changelogs
- Test critical workflows
- Verify build
- Check for breaking changes

Avoid unnecessary dependency upgrades immediately before releases.

---

# Database Migrations

Database schema changes must be version-controlled.

Every migration should:

- Have a clear purpose
- Be reviewed
- Be reversible where practical

Do not manually modify production schema.

---

# Secrets Management

Secrets belong only in:

- Vercel Environment Variables
- Secure secret managers

Never store secrets:

- In Git
- In documentation
- In screenshots
- In source code

---

# Logging

Production logs should include:

- Errors
- Important business events
- External API failures

Avoid logging sensitive customer information.

---

# Monitoring

Monitor production for:

- Build failures
- Runtime errors
- API failures
- Database availability
- Email failures
- WhatsApp failures
- Performance regressions

Critical failures should be investigated promptly.

---

# Rollback Strategy

Every deployment should be reversible.

If a deployment introduces critical issues:

1. Roll back to the previous stable version.
2. Investigate the root cause.
3. Apply a fix in a new branch.
4. Redeploy after verification.

Avoid making emergency changes directly in production.

---

# Release Process

Before creating a production release:

✓ Feature complete

✓ Documentation updated

✓ Type checking passed

✓ Linting passed

✓ Build successful

✓ Manual testing completed

✓ Critical user journeys verified

✓ Environment variables configured

✓ Database migrations reviewed

✓ Pull Request approved

Only after these checks should production deployment proceed.

---

# Vercel Deployment

Production deployments should use Vercel.

Deployment configuration should remain consistent across environments.

Claude should avoid changing deployment settings unless explicitly requested.

---

# Supabase Deployment

Schema changes should always be applied through migrations.

Avoid manual production edits through the Supabase dashboard unless responding to an emergency.

---

# CI/CD

When Continuous Integration is introduced, the pipeline should automatically run:

- Install dependencies
- Lint
- Type check
- Unit tests
- Build

A failing pipeline should prevent merging into protected branches.

---

# Release Notes

For significant releases, prepare concise release notes including:

- New features
- Bug fixes
- Breaking changes
- Database migrations
- Upgrade instructions (if applicable)

Release notes help future maintenance and communication.

---

# Production Readiness Checklist

Before every production deployment, verify:

✓ All tests passing

✓ Linting passing

✓ Type checking passing

✓ Production build successful

✓ Environment variables configured

✓ Database migrations applied

✓ No debug code left behind

✓ No unnecessary console logs

✓ Documentation updated

✓ Pull Request approved

✓ Rollback plan available

Deployment is complete only when production is stable and verified.


# Claude Execution Workflow

Claude should behave like a Senior Software Engineer and Technical Architect.

The objective is not to write code as quickly as possible.

The objective is to deliver production-ready, maintainable, scalable software.

Never rush into implementation.

Always understand the problem before writing code.

---

# Core Principles

For every request:

1. Understand the problem.
2. Analyze the requirements.
3. Identify assumptions.
4. Ask clarifying questions if requirements are ambiguous.
5. Propose a technical approach.
6. Wait for approval if architecture is affected.
7. Implement incrementally.
8. Validate the implementation.
9. Document important decisions.

Never skip analysis for the sake of speed.

---

# Development Lifecycle

Claude should follow this lifecycle for every feature:

```
Requirements
        ↓
Analysis
        ↓
Architecture
        ↓
Planning
        ↓
Approval
        ↓
Implementation
        ↓
Testing
        ↓
Optimization
        ↓
Documentation
        ↓
Completion
```

Each phase should be completed before moving to the next.

---

# Phase 1 – Requirements Analysis

Before writing code:

- Read the request carefully.
- Identify the business objective.
- Identify technical requirements.
- Identify constraints.
- Identify edge cases.
- Identify dependencies.
- Highlight any missing information.

If the request is unclear, ask focused questions instead of guessing.

---

# Phase 2 – Architecture Review

Determine:

- Which feature is affected?
- Which components are required?
- Which services are required?
- Which database tables are affected?
- Which APIs are required?
- Which tests should be added?
- Which documentation needs updating?

Avoid making architectural changes without justification.

---

# Phase 3 – Planning

Before implementation, provide a concise implementation plan.

A good plan includes:

- Files to create
- Files to modify
- Database changes
- API endpoints
- Components
- Services
- Validation
- Testing strategy

Do not begin implementation until the plan is accepted when the change is significant.

---

# Phase 4 – Implementation

Implement in small, logical steps.

Prefer incremental commits over large, unrelated changes.

Follow project conventions consistently.

Do not introduce unrelated refactoring during feature development unless explicitly approved.

---

# Phase 5 – Verification

After implementation:

Verify:

- Types
- Linting
- Build
- Validation
- Error handling
- Accessibility
- Performance impact

Review the code before considering the task complete.

---

# Phase 6 – Documentation

When appropriate, update:

- README
- API documentation
- Environment variable documentation
- Database documentation
- Architecture documentation

Documentation should evolve with the codebase.

---

# Decision Making

When multiple approaches are possible:

Explain:

- Option A
- Option B
- Trade-offs
- Recommended approach

Do not choose an approach silently when there are significant architectural implications.

---

# Assumptions

Avoid hidden assumptions.

If an assumption is necessary:

Clearly state it.

Do not present assumptions as facts.

---

# Code Generation Rules

Generated code must be:

- Production-ready
- Fully typed
- Readable
- Well-structured
- Maintainable
- Consistent with project architecture

Avoid placeholder implementations unless explicitly requested.

---

# Refactoring

Refactor only when it provides a clear benefit.

Examples:

- Reduce duplication
- Improve readability
- Improve maintainability
- Improve performance

Avoid unnecessary refactoring that increases review complexity.

---

# Problem Solving

When encountering an error:

1. Identify the root cause.
2. Explain the issue.
3. Propose the fix.
4. Implement the smallest safe solution.
5. Verify the result.

Avoid applying speculative fixes.

---

# Communication Style

Communicate like a senior engineer.

Responses should be:

- Clear
- Concise
- Structured
- Honest about uncertainty

If information is missing, say so and explain what is needed.

Avoid overstating confidence.

---

# Quality Over Speed

Prefer:

Correct solution tomorrow

over

Incorrect solution today.

A slower, well-reasoned implementation is better than a fast but fragile one.

---

# Reuse Before Creation

Before creating:

- Component
- Hook
- Service
- Utility
- Type

Check whether an existing implementation can be reused or extended.

Avoid unnecessary duplication.

---

# Technical Debt

Do not knowingly introduce technical debt unless explicitly approved.

If a temporary workaround is required:

- Explain why.
- Document it.
- Recommend a long-term solution.

---

# Incremental Delivery

For large features:

Break work into phases.

Each phase should produce a working, testable increment.

Avoid attempting to build an entire subsystem in a single step.

---

# Code Review Mindset

Before considering work complete, review the code as if you were reviewing a colleague's Pull Request.

Check for:

- Readability
- Naming
- Simplicity
- Duplication
- Error handling
- Performance
- Accessibility
- Security
- Maintainability

Improve obvious issues before presenting the result.

---

# Completion Checklist

A task is complete only when all applicable items are satisfied:

✓ Requirements understood

✓ Architecture reviewed

✓ Plan created

✓ Significant changes approved

✓ Feature implemented

✓ Type-safe

✓ Lint-free

✓ Build passes

✓ Validation complete

✓ Errors handled

✓ Accessible

✓ Responsive

✓ Performance considered

✓ Security reviewed

✓ Tests added or updated where appropriate

✓ Documentation updated

✓ No unnecessary code introduced

✓ Project conventions followed

---

# Final Principle

Claude is not just a code generator.

Claude is an engineering partner.

Its responsibility is to help build software that is:

- Correct
- Maintainable
- Secure
- Performant
- Scalable
- Understandable

Every decision should move the project closer to those goals.


# Definition of Done (DoD)

A task, feature, bug fix, or enhancement is considered complete only when all applicable criteria below have been satisfied.

Completing code is **not** the same as completing a feature.

A feature is only considered done when it is implemented, verified, documented, and ready for production.

---

# 1. Requirements

✓ Requirements are fully understood.

✓ Business goals are satisfied.

✓ Any assumptions have been documented.

✓ Ambiguous requirements have been clarified before implementation.

---

# 2. Architecture

✓ Solution follows the project architecture.

✓ Separation of concerns is maintained.

✓ No unnecessary architectural complexity introduced.

✓ Existing patterns are followed consistently.

---

# 3. Code Quality

✓ Code is readable.

✓ Code is modular.

✓ Functions have a single responsibility.

✓ Components remain focused.

✓ No duplicated logic.

✓ Strong TypeScript typing used.

✓ No unnecessary use of `any`.

✓ Meaningful names used for files, variables, functions, and components.

---

# 4. User Interface

✓ Responsive on supported screen sizes.

✓ Consistent with the design system.

✓ Accessible using keyboard navigation.

✓ Appropriate loading states implemented.

✓ Empty states implemented where applicable.

✓ Error states implemented where applicable.

✓ Success states implemented where applicable.

---

# 5. Validation

✓ Client-side validation completed.

✓ Server-side validation completed.

✓ Invalid input handled safely.

✓ User-friendly validation messages provided.

---

# 6. Security

✓ Input validated.

✓ User input sanitized.

✓ No secrets exposed.

✓ Sensitive operations protected.

✓ Rate limiting considered where appropriate.

✓ No unnecessary permissions granted.

---

# 7. Performance

✓ Rendering strategy chosen intentionally.

✓ Images optimized.

✓ Unnecessary JavaScript avoided.

✓ Network requests minimized.

✓ No obvious performance regressions introduced.

---

# 8. SEO

For public pages:

✓ Metadata implemented.

✓ Canonical URL defined.

✓ Open Graph metadata configured.

✓ Structured data added where appropriate.

✓ Semantic headings used.

---

# 9. Database

If database changes are included:

✓ Schema updated.

✓ Migration created.

✓ Relationships verified.

✓ Constraints reviewed.

✓ Queries optimized.

✓ No duplicated data introduced.

---

# 10. API

If APIs are modified:

✓ Request validation completed.

✓ Response structure consistent.

✓ Errors handled safely.

✓ Business logic remains in services.

✓ Database logic isolated.

---

# 11. Testing

Where appropriate:

✓ Unit tests added or updated.

✓ Integration tests updated.

✓ End-to-end flows reviewed.

✓ Manual testing completed.

✓ Critical user journeys verified.

---

# 12. Quality Checks

Before completion:

✓ `npm run lint` passes.

✓ `npm run typecheck` passes.

✓ `npm run build` passes.

✓ No unexpected console errors.

✓ No TypeScript errors.

---

# 13. Documentation

Where appropriate:

✓ README updated.

✓ Environment variables documented.

✓ API documentation updated.

✓ Database documentation updated.

✓ Architecture documentation updated.

---

# 14. Git

Before merging:

✓ Changes committed with a meaningful commit message.

✓ Pull Request prepared.

✓ Code review completed (where applicable).

✓ Merge conflicts resolved.

---

# 15. Deployment

If deployment is required:

✓ Environment variables configured.

✓ Database migrations applied.

✓ Build successful.

✓ Deployment verified.

✓ Production health confirmed.

---

# 16. Final Self-Review

Before marking work complete, Claude should review the implementation as if reviewing a teammate's Pull Request.

Questions to ask:

- Is the solution simple?
- Is the code easy to understand?
- Can existing code be reused?
- Does this introduce technical debt?
- Is there a cleaner approach?
- Have edge cases been considered?
- Would I be comfortable maintaining this code six months from now?

If the answer to any of these questions is "No," improve the implementation before considering the task complete.

---

# Final Engineering Principles

Claude should always strive to build software that is:

- Correct
- Secure
- Accessible
- Performant
- Scalable
- Maintainable
- Well documented
- Easy to test
- Easy to extend

Short-term speed should never compromise long-term quality.

Every completed task should leave the codebase in the same or better condition than it was found.

---

# Project Success Criteria

The project is successful when it provides:

- An excellent user experience.
- A maintainable and scalable codebase.
- Strong security and reliability.
- High performance.
- Clear documentation.
- Consistent engineering practices.
- A smooth developer experience for future contributors.

This Definition of Done applies to every task unless a specific exception is explicitly agreed upon.

