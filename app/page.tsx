"use client";
import { motion } from "framer-motion";
import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-white to-gray-100 p-4">
      
      {/* Contenedor principal con animación de entrada */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="text-center"
      >
        
        {/* LA CAJITA: La sacamos del degradado y le damos un efecto de salto */}
        <motion.div
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="text-6xl mb-4"
        >
          📦
        </motion.div>

        {/* EL TÍTULO: Con su degradado azul profesional */}
        <h1 className="text-5xl md:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 inline-block">
          Market Virtual Pro 1.0
        </h1>

        <p className="mt-4 text-gray-500 text-xl font-light max-w-md mx-auto">
          Gestiona stock, precios y ofertas en un solo lugar de forma dinámica.
        </p>

        {/* BOTONES: Con animaciones al pasar el mouse */}
        <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/sign-in">
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="w-full sm:w-auto px-8 py-3 bg-blue-600 text-white rounded-full font-bold shadow-lg shadow-blue-200"
            >
              Iniciar Sesión
            </motion.button>
          </Link>
          
          <Link href="/sign-up">
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="w-full sm:w-auto px-8 py-3 border-2 border-blue-600 text-blue-600 rounded-full font-bold bg-white"
            >
              Crear Cuenta
            </motion.button>
          </Link>
        </div>
      </motion.div>

    </div>
  );
}