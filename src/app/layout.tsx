import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { AuthActionsProvider } from '@/providers/auth-provider';
import ClientProviders from '@/providers/client-providers';

export const metadata: Metadata = {
  title: 'Visualizae 3.0',
  description: 'An AI-powered canvas editor for stunning visuals.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {


  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <head>
        <meta name="theme-color" content="hsl(var(--background))" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Source+Code+Pro&family=Space+Grotesk:wght@400;500;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased">
        <ClientProviders>
          <AuthActionsProvider>
            {children}
            <Toaster />
          </AuthActionsProvider>
        </ClientProviders>
      </body>
    </html>
  );
}
