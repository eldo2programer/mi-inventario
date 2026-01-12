import { ClerkProvider } from '@clerk/nextjs'
import { esES } from '@clerk/localizations'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

// Configuración de fuentes (ya vienen por defecto en Next.js)
const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata = {
  title: 'Mi Inventario Dinámico',
  description: 'Sistema profesional de gestión de stock',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider 
      localization={esES} 
      appearance={{
        layout: {
          socialButtonsVariant: 'iconButton',
          shimmer: true
        },
        variables: { 
          // --- AQUÍ CAMBIAS TUS COLORES ---
          colorPrimary: '#1e55cc',    // Azul principal
          colorBackground: '#ffffff',  // Fondo de los cuadros
          colorText: '#1f2937',        // Texto casi negro
          colorInputBackground: '#ffffff', // Fondo de los campos de texto
          borderRadius: '0.75rem',     // Bordes redondeados modernos
        },
      }}
    >
      <html lang="es">
        <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
          {/* El contenido de cada página se renderiza aquí */}
          {children}
        </body>
      </html>
    </ClerkProvider>
  )
}