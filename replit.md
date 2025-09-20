# QR Code Generator App

## Overview

This is a full-stack web application built with React and Express that generates customizable QR codes. The app allows users to create QR codes from text, URLs, or contact information with customizable colors and sizes. It features a modern UI built with shadcn/ui components and Tailwind CSS.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript and Vite for fast development and building
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack React Query for server state management and caching
- **Styling**: Tailwind CSS with shadcn/ui component library for consistent, accessible UI components
- **Form Handling**: React Hook Form with Zod for validation
- **QR Code Generation**: qrcode library for generating QR codes on HTML5 canvas

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **Build System**: esbuild for production bundling
- **Development**: tsx for TypeScript execution in development
- **Storage**: In-memory storage implementation with interface for future database integration

### Database Design
- **ORM**: Drizzle ORM configured for PostgreSQL
- **Schema**: User table with id, username, and password fields
- **Migrations**: Drizzle Kit for schema migrations
- **Database Provider**: Configured for Neon Database (serverless PostgreSQL)

### Development Tools
- **Bundler**: Vite with React plugin for frontend development
- **TypeScript**: Strict configuration with path mapping for clean imports
- **Linting**: Configured for consistent code style
- **Hot Reload**: Vite HMR for instant development feedback

### UI Component System
- **Design System**: shadcn/ui with "new-york" style variant
- **Base Color**: Neutral color scheme with CSS custom properties
- **Accessibility**: Radix UI primitives for keyboard navigation and screen readers
- **Responsive Design**: Mobile-first approach with Tailwind breakpoints

## External Dependencies

### Core Framework Dependencies
- **React**: UI library with TypeScript support
- **Express**: Web server framework for API routes
- **Vite**: Build tool and development server

### Database & ORM
- **Drizzle ORM**: Type-safe database operations
- **@neondatabase/serverless**: Serverless PostgreSQL driver
- **connect-pg-simple**: PostgreSQL session store

### UI & Styling
- **Tailwind CSS**: Utility-first CSS framework
- **Radix UI**: Accessible component primitives for complex UI elements
- **Lucide React**: Icon library for consistent iconography
- **class-variance-authority**: Component variant management

### State Management & Forms
- **TanStack React Query**: Server state management and caching
- **React Hook Form**: Form handling with minimal re-renders
- **Zod**: Schema validation library

### QR Code Generation
- **qrcode**: QR code generation library for canvas rendering

### Development Tools
- **TypeScript**: Type safety across the stack
- **tsx**: TypeScript execution for development
- **esbuild**: Fast JavaScript bundler for production
- **Replit Plugins**: Development environment enhancements for Replit