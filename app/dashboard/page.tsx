"use client";
import { useState, useRef, useMemo, ChangeEvent, useEffect } from "react";
import { UserButton, useUser, useAuth } from "@clerk/nextjs";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { getSupabaseClient } from "../lib/supabase";

// --- Tipado Completo (No falta nada) ---
interface Producto {
  id: string;
  nombre: string;
  descripcion: string;
  precio: number;
  costo: number;
  stock: number;
  oferta: boolean;
  descuento: number;
  imagenes: string[];
  categoria: string;
  tallas: string[];
  tipoventa: string;
  modalidadmayor: string;
  minimomayor?: number;
  user_id: string;
}

const CATEGORIAS = ["Todos", "Agotándose", "General", "Cosméticos", "Comida", "Ropa", "Joyería", "Limpieza"];
const TALLAS_DISPONIBLES = ["Única", "XS", "S", "M", "L", "XL", "XXL", "36", "38", "40", "42", "44"];

// --- Variantes de Animación de Alto Impacto ---
const containerVariants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.2 }
  }
};

const itemVariants = {
  hidden: { y: 30, opacity: 0, scale: 0.95 },
  visible: { 
    y: 0, 
    opacity: 1, 
    scale: 1,
    transition: { type: "spring", stiffness: 100, damping: 15 }
  },
  exit: { opacity: 0, scale: 0.5, transition: { duration: 0.2 } }
};

const modalVariants = {
  hidden: { opacity: 0, y: 100, scale: 0.9 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", damping: 25, stiffness: 300 } },
  exit: { opacity: 0, y: 100, scale: 0.9, transition: { duration: 0.3 } }
};

export default function Dashboard() {
  const { user, isLoaded } = useUser();
  const { getToken } = useAuth(); 
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // --- Estados de Datos ---
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);

  // --- Estados de UI ---
  const [busqueda, setBusqueda] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("Todos");
  const [orden, setOrden] = useState("nombre");
  const [showModal, setShowModal] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [productoSeleccionado, setProductoSeleccionado] = useState<Producto | null>(null);
  const [fotoActual, setFotoActual] = useState(0);

  // --- Estados del Formulario (Restaurados todos) ---
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [precio, setPrecio] = useState("");
  const [costo, setCosto] = useState("");
  const [stock, setStock] = useState("");
  const [imagenes, setImagenes] = useState<string[]>([]);
  const [esOferta, setEsOferta] = useState(false);
  const [porcentaje, setPorcentaje] = useState(0);
  const [categoria, setCategoria] = useState("General");
  const [tallasSel, setTallasSel] = useState<string[]>([]);
  const [tipoVenta, setTipoVenta] = useState("Unidad");
  const [modalidadMayor, setModalidadMayor] = useState("Al Detal");
  const [minimoMayor, setMinimoMayor] = useState("");

  useEffect(() => {
    if (isLoaded && user) fetchProductos();
  }, [user, isLoaded]);

  const fetchProductos = async () => {
    try {
      setLoading(true);
      const token = await getToken({ template: 'supabase' });
      const supabase = await getSupabaseClient(token);
      const { data, error } = await supabase.from('productos').select('*').order('nombre', { ascending: true });
      if (error) throw error;
      setProductos(data || []);
    } catch (err) {
      console.error("Error cargando productos:", err);
    } finally {
      setLoading(false);
    }
  };

  const guardarProducto = async () => {
    if (!user) return alert("Debes iniciar sesión");
    if (!nombre || !precio || !stock) return alert("Por favor rellena Nombre, Precio y Stock");

    // CORRECCIÓN CLAVE: Nombres de columnas en minúsculas para Supabase
    const datosBase = {
      nombre,
      descripcion,
      precio: Number(precio),
      costo: Number(costo) || 0,
      stock: Number(stock),
      oferta: esOferta,
      descuento: porcentaje,
      categoria,
      tallas: tallasSel,
      tipoventa: tipoVenta, 
      modalidadmayor: modalidadMayor,
      user_id: user.id, 
      imagenes: imagenes.length > 0 ? imagenes : ["https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600"],
      minimomayor: modalidadMayor === "Al Mayor" ? Number(minimoMayor) : null 
    };

    try {
      const token = await getToken({ template: 'supabase' });
      const supabase = await getSupabaseClient(token);

      if (editandoId) {
        const { error } = await supabase.from('productos').update(datosBase).eq('id', editandoId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('productos').insert([{
          ...datosBase,
          id: window.crypto.randomUUID() // Web API segura para linter
        }]);
        if (error) throw error;
      }

      fetchProductos();
      cerrarModal();
      alert("¡Registro guardado con éxito!");
    } catch (err: any) {
      alert(`Error de base de datos: ${err.message}`);
    }
  };

  const borrarProducto = async (id: string) => {
    if (!confirm("¿Seguro que deseas eliminar este producto permanentemente?")) return;
    try {
      const token = await getToken({ template: 'supabase' });
      const supabase = await getSupabaseClient(token);
      const { error } = await supabase.from('productos').delete().eq('id', id);
      if (error) throw error;
      fetchProductos();
    } catch (err) {
      console.error("Error al borrar:", err);
    }
  };

  const ajustarStock = async (id: string, cambio: number) => {
    const prod = productos.find(p => p.id === id);
    if (!prod) return;
    const nuevoStock = Math.max(0, prod.stock + cambio);
    try {
      const token = await getToken({ template: 'supabase' });
      const supabase = await getSupabaseClient(token);
      const { error } = await supabase.from('productos').update({ stock: nuevoStock }).eq('id', id);
      if (error) throw error;
      setProductos(productos.map(p => p.id === id ? { ...p, stock: nuevoStock } : p));
    } catch (err) {
      console.error(err);
    }
  };

  const cerrarModal = () => {
    setShowModal(false); setEditandoId(null); setNombre(""); setDescripcion(""); setPrecio(""); setCosto("");
    setStock(""); setImagenes([]); setEsOferta(false); setCategoria("General");
    setTallasSel([]); setPorcentaje(0); setTipoVenta("Unidad"); setModalidadMayor("Al Detal"); setMinimoMayor("");
  };

  const toggleTalla = (talla: string) => {
    setTallasSel(prev => prev.includes(talla) ? prev.filter(t => t !== talla) : [...prev, talla]);
  };

  const handleMultipleImages = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => setImagenes(prev => [...prev, reader.result as string]);
      reader.readAsDataURL(file);
    });
  };

  // --- Lógica de Filtros y Estadísticas ---
  const stats = useMemo(() => ({
    inversion: productos.reduce((acc, p) => acc + (p.costo * p.stock), 0),
    ganancia: productos.reduce((acc, p) => acc + ((p.precio - p.costo) * p.stock), 0),
    bajoStock: productos.filter(p => p.stock <= 5).length,
    totalUnidades: productos.reduce((acc, p) => acc + p.stock, 0)
  }), [productos]);

  const productosFiltrados = useMemo(() => {
    const f = productos.filter(p => 
      p.nombre.toLowerCase().includes(busqueda.toLowerCase()) &&
      (filtroCategoria === "Todos" ? true : (filtroCategoria === "Agotándose" ? p.stock <= 5 : p.categoria === filtroCategoria))
    );
    if (orden === "precio-min") f.sort((a, b) => a.precio - b.precio);
    if (orden === "precio-max") f.sort((a, b) => b.precio - a.precio);
    return f;
  }, [productos, busqueda, filtroCategoria, orden]);

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-20 text-slate-900 print:bg-white selection:bg-blue-600 selection:text-white">
      
      {/* NAVBAR CON GLASSMORPHISM */}
      <nav className="bg-white/80 backdrop-blur-2xl border-b sticky top-0 z-[60] px-8 py-5 flex justify-between items-center print:hidden shadow-sm">
        <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl flex items-center justify-center shadow-xl shadow-blue-200">
            <span className="text-2xl text-white font-bold">S</span>
          </div>
          <div>
            <h1 className="text-2xl font-black bg-gradient-to-r from-blue-700 to-indigo-600 bg-clip-text text-transparent italic uppercase tracking-tighter leading-none">Store Virtual</h1>
            <p className="text-[9px] font-black text-slate-400 tracking-[0.3em] uppercase mt-1">Inventory Management v2.0</p>
          </div>
        </motion.div>
        
        <div className="flex items-center gap-6">
          <button onClick={() => window.print()} className="hidden md:flex items-center gap-2 px-6 py-3 bg-white border border-slate-100 rounded-2xl text-[10px] font-black uppercase shadow-sm hover:shadow-md transition-all active:scale-95">
            <span>🖨️</span> Exportar a PDF
          </button>
          <div className="h-10 w-[1px] bg-slate-100"></div>
          <UserButton afterSignOutUrl="/" appearance={{ elements: { userButtonAvatarBox: "w-11 h-11 border-2 border-white shadow-md" } }} />
        </div>
      </nav>

      <main className="p-8 max-w-[1600px] mx-auto">
        
        {/* DASHBOARD STATS */}
        <motion.div variants={containerVariants} initial="hidden" animate="visible" className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12 print:grid-cols-2">
          {[
            { label: "Inversión Total", val: `$${stats.inversion.toLocaleString()}`, icon: "💰", color: "text-slate-600", bg: "bg-white" },
            { label: "Ganancia Estimada", val: `$${stats.ganancia.toLocaleString()}`, icon: "📈", color: "text-blue-600", bg: "bg-blue-50/50" },
            { label: "Alertas de Stock", val: `${stats.bajoStock} items`, icon: "🚨", color: "text-red-600", bg: "bg-red-50/50" },
            { label: "Unidades en Bodega", val: stats.totalUnidades, icon: "📦", color: "text-indigo-600", bg: "bg-indigo-50/50" }
          ].map((s, i) => (
            <motion.div key={i} variants={itemVariants} className={`${s.bg} p-8 rounded-[3.5rem] border border-slate-100 shadow-sm flex flex-col items-center text-center group hover:shadow-2xl transition-all duration-500`}>
              <span className="text-4xl mb-4 group-hover:rotate-12 transition-transform">{s.icon}</span>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{s.label}</p>
              <p className={`text-3xl font-black ${s.color}`}>{s.val}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* BARRA DE ACCIONES Y FILTROS */}
        <div className="mb-12 print:hidden space-y-8">
          <div className="flex gap-3 overflow-x-auto pb-4 no-scrollbar">
            {CATEGORIAS.map((cat) => (
              <button 
                key={cat} 
                onClick={() => setFiltroCategoria(cat)}
                className={`px-8 py-3 rounded-full text-[10px] font-black transition-all whitespace-nowrap border-2 ${
                  filtroCategoria === cat 
                  ? 'bg-slate-900 text-white border-slate-900 shadow-2xl shadow-slate-300' 
                  : 'bg-white text-slate-400 border-slate-50 hover:border-blue-200'
                }`}
              >
                {cat.toUpperCase()}
              </button>
            ))}
          </div>

          <div className="flex flex-col lg:flex-row gap-6">
            <div className="relative flex-1 group">
              <span className="absolute left-7 top-1/2 -translate-y-1/2 text-xl group-focus-within:scale-110 transition-transform">🔍</span>
              <input 
                type="text" 
                placeholder="Buscar por nombre o descripción..." 
                value={busqueda} 
                onChange={(e) => setBusqueda(e.target.value)}
                className="w-full p-7 pl-16 bg-white rounded-[2.5rem] shadow-sm outline-none border-2 border-transparent focus:border-blue-500/10 focus:shadow-2xl transition-all font-bold text-slate-700"
              />
            </div>
            <div className="flex gap-4">
              <select 
                value={orden} 
                onChange={(e) => setOrden(e.target.value)}
                className="p-7 bg-white rounded-[2.2rem] font-black text-[10px] uppercase outline-none shadow-sm border-2 border-transparent hover:border-slate-100 cursor-pointer px-12 text-slate-500 appearance-none"
              >
                <option value="nombre">Ordenar: A-Z</option>
                <option value="precio-min">Precio: Menor</option>
                <option value="precio-max">Precio: Mayor</option>
              </select>
              <button 
                onClick={() => setShowModal(true)}
                className="px-14 py-7 bg-blue-600 text-white rounded-[2.5rem] font-black uppercase text-[11px] shadow-2xl shadow-blue-200 hover:bg-blue-700 hover:scale-105 active:scale-95 transition-all"
              >
                + Nuevo Producto
              </button>
            </div>
          </div>
        </div>

        {/* GRID DE PRODUCTOS CON ANIMACIÓN DE LAYOUT */}
        <LayoutGroup>
          <motion.div layout variants={containerVariants} initial="hidden" animate="visible" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-10">
            <AnimatePresence mode="popLayout">
              {productosFiltrados.map((prod) => (
                <motion.div 
                  layout
                  variants={itemVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  key={prod.id} 
                  className="bg-white rounded-[4rem] overflow-hidden border border-slate-50 shadow-sm hover:shadow-[0_30px_60px_-15px_rgba(0,0,0,0.1)] transition-all duration-700 cursor-pointer group relative"
                  onClick={() => setProductoSeleccionado(prod)}
                >
                  <div className="h-80 relative bg-slate-100 overflow-hidden">
                    <img src={prod.imagenes[0]} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" alt="" />
                    {prod.oferta && (
                      <div className="absolute top-7 left-7 bg-red-500 text-white text-[10px] font-black px-5 py-2 rounded-full shadow-xl animate-pulse italic">
                        {prod.descuento}% OFF
                      </div>
                    )}
                    <div className="absolute bottom-7 right-7 bg-white/95 backdrop-blur px-5 py-2 rounded-full text-[9px] font-black shadow-lg uppercase tracking-widest text-slate-800">
                      {prod.categoria}
                    </div>
                  </div>

                  <div className="p-10">
                    <h4 className="font-bold text-2xl truncate mb-2 text-slate-800 tracking-tight">{prod.nombre}</h4>
                    <div className="flex items-center gap-3 mb-8">
                      <p className="text-4xl font-black text-slate-900">${prod.precio}</p>
                      {prod.oferta && <p className="text-lg text-slate-300 line-through font-bold">${(prod.precio / (1 - prod.descuento/100)).toFixed(0)}</p>}
                    </div>

                    <div className="flex justify-between items-center bg-slate-50/80 p-3 rounded-[2rem] mb-8" onClick={e => e.stopPropagation()}>
                      <button onClick={() => ajustarStock(prod.id, -1)} className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center font-black shadow-sm hover:bg-red-50 hover:text-red-500 transition-all active:scale-90">-</button>
                      <div className="text-center">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Existencia</p>
                        <p className={`text-xl font-black ${prod.stock <= 5 ? 'text-red-500 animate-pulse' : 'text-slate-800'}`}>{prod.stock}</p>
                      </div>
                      <button onClick={() => ajustarStock(prod.id, 1)} className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center font-black shadow-sm hover:bg-green-50 hover:text-green-500 transition-all active:scale-90">+</button>
                    </div>

                    <div className="flex justify-between items-center" onClick={e => e.stopPropagation()}>
                      <div className="flex gap-3">
                        <button onClick={() => { 
                          setEditandoId(prod.id); setNombre(prod.nombre); setDescripcion(prod.descripcion); setPrecio(prod.precio.toString()); setCosto(prod.costo.toString()); setStock(prod.stock.toString()); setCategoria(prod.categoria); setTallasSel(prod.tallas || []); setEsOferta(prod.oferta); setPorcentaje(prod.descuento); setImagenes(prod.imagenes); setTipoVenta(prod.tipoventa); setModalidadMayor(prod.modalidadmayor); setMinimoMayor(prod.minimomayor?.toString() || ""); setShowModal(true); 
                        }} className="w-14 h-14 bg-blue-50 text-blue-600 rounded-[1.5rem] flex items-center justify-center hover:bg-blue-600 hover:text-white transition-all shadow-sm">✏️</button>
                        <button onClick={() => borrarProducto(prod.id)} className="w-14 h-14 bg-red-50 text-red-600 rounded-[1.5rem] flex items-center justify-center hover:bg-red-600 hover:text-white transition-all shadow-sm">🗑️</button>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] font-black text-slate-400 uppercase">Costo Base</p>
                        <p className="font-bold text-slate-400 text-sm italic">${prod.costo}</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        </LayoutGroup>

        {/* MODAL DETALLE PRODUCTO (FULL SCREEN EXPERIENCE) */}
        <AnimatePresence>
          {productoSeleccionado && (
            <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-2xl flex items-center justify-center z-[100] p-6" onClick={() => setProductoSeleccionado(null)}>
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 50 }} 
                animate={{ opacity: 1, scale: 1, y: 0 }} 
                exit={{ opacity: 0, scale: 0.9, y: 50 }}
                className="bg-white w-full max-w-7xl rounded-[5rem] overflow-hidden flex flex-col md:flex-row h-[90vh] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)]"
                onClick={e => e.stopPropagation()}
              >
                <div className="md:w-3/5 bg-slate-950 relative flex items-center justify-center p-12 group">
                  <img src={productoSeleccionado.imagenes[fotoActual]} className="max-h-full max-w-full object-contain drop-shadow-[0_20px_80px_rgba(255,255,255,0.15)] transition-transform duration-700 group-hover:scale-105" alt="" />
                  
                  {/* Navegación Fotos */}
                  <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex gap-4 bg-black/20 p-3 rounded-full backdrop-blur-xl">
                    {productoSeleccionado.imagenes.map((_, i) => (
                      <button key={i} onClick={() => setFotoActual(i)} className={`w-4 h-4 rounded-full transition-all ${fotoActual === i ? 'bg-white w-12' : 'bg-white/30 hover:bg-white/50'}`} />
                    ))}
                  </div>
                </div>
                
                <div className="md:w-2/5 p-20 overflow-y-auto bg-white flex flex-col">
                  <div className="flex justify-between items-start mb-12">
                    <div>
                      <span className="px-6 py-2 bg-blue-50 text-blue-700 rounded-full text-[11px] font-black uppercase tracking-[0.2em]">{productoSeleccionado.categoria}</span>
                      <h3 className="text-6xl font-black text-slate-900 mt-8 leading-none tracking-tighter italic">{productoSeleccionado.nombre}</h3>
                    </div>
                    <button onClick={() => setProductoSeleccionado(null)} className="w-14 h-14 bg-slate-50 rounded-full flex items-center justify-center text-2xl hover:bg-slate-100 transition-all hover:rotate-90">✕</button>
                  </div>

                  <p className="text-slate-500 font-medium text-xl leading-relaxed mb-12 italic">"{productoSeleccionado.descripcion || "Sin descripción detallada por el momento."}"</p>
                  
                  {/* Tallas en Detalle */}
                  <div className="mb-12">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Tallas Disponibles</p>
                    <div className="flex flex-wrap gap-3">
                      {productoSeleccionado.tallas?.length > 0 ? productoSeleccionado.tallas.map(t => (
                        <span key={t} className="px-6 py-3 bg-slate-900 text-white rounded-2xl font-black text-xs shadow-lg">{t}</span>
                      )) : <span className="text-slate-300 font-bold italic">No especificado</span>}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-8 mb-16">
                    <div className="bg-slate-50 p-10 rounded-[3rem] border border-slate-100">
                      <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3 text-center">Precio Público</p>
                      <p className="text-5xl font-black text-slate-900 text-center">${productoSeleccionado.precio}</p>
                    </div>
                    <div className="bg-slate-50 p-10 rounded-[3rem] border border-slate-100 text-center">
                      <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">Disponible</p>
                      <p className={`text-5xl font-black ${productoSeleccionado.stock <= 5 ? 'text-red-500' : 'text-slate-900'}`}>{productoSeleccionado.stock}</p>
                    </div>
                  </div>

                  <div className="mt-auto space-y-4">
                    <button 
                      onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent('🔥 *NUEVO PRODUCTO DISPONIBLE* 🔥\n\n🛍️ *Item:* ' + productoSeleccionado.nombre + '\n💰 *Precio:* $' + productoSeleccionado.precio + '\n📦 *Stock:* ' + productoSeleccionado.stock + '\n📏 *Tallas:* ' + productoSeleccionado.tallas?.join(', ') + '\n\n_¡Pide el tuyo ahora!_')}`)}
                      className="w-full py-7 bg-green-500 text-white rounded-[3rem] font-black uppercase text-xs shadow-2xl shadow-green-100 hover:bg-green-600 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-4"
                    >
                      <span className="text-2xl">📱</span> Enviar Catálogo WhatsApp
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* MODAL REGISTRO (FORMULARIO EXTENDIDO) */}
        <AnimatePresence>
          {showModal && (
            <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xl flex items-center justify-center z-[100] p-6 overflow-y-auto">
              <motion.div 
                variants={modalVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="bg-white w-full max-w-4xl rounded-[5rem] p-16 shadow-2xl my-auto relative border border-white/20"
                onClick={e => e.stopPropagation()}
              >
                <div className="mb-14 flex items-center gap-6">
                  <div className="w-16 h-16 bg-blue-600 rounded-[2rem] flex items-center justify-center text-white text-2xl shadow-xl shadow-blue-200">
                    {editandoId ? '✏️' : '✨'}
                  </div>
                  <div>
                    <h3 className="text-4xl font-black uppercase tracking-tighter text-slate-900 italic leading-none">
                      {editandoId ? "Editar Registro" : "Nuevo Producto"}
                    </h3>
                    <p className="text-slate-400 font-bold text-[10px] mt-2 uppercase tracking-widest italic">Gestión Profesional de Inventario</p>
                  </div>
                </div>

                <div className="space-y-8">
                  {/* Seccion 1: Datos Básicos */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-3">
                      <label className="text-[11px] font-black uppercase text-slate-400 ml-6 tracking-widest">Nombre Comercial</label>
                      <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Zapatillas Urban Air" className="w-full p-7 bg-slate-50 rounded-[2.5rem] outline-none font-bold text-slate-700 border-2 border-transparent focus:border-blue-500/10 transition-all shadow-inner" />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[11px] font-black uppercase text-slate-400 ml-6 tracking-widest">Categoría de Venta</label>
                      <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="w-full p-7 bg-slate-50 rounded-[2.5rem] outline-none font-black text-slate-700 border-2 border-transparent focus:border-blue-500/10 transition-all appearance-none cursor-pointer">
                        {CATEGORIAS.filter(c => c !== "Todos").map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Sección 2: Precios y Stock */}
                  <div className="grid grid-cols-3 gap-6">
                    <div className="space-y-3">
                      <label className="text-[11px] font-black uppercase text-slate-400 ml-6 tracking-widest">Costo Base</label>
                      <input value={costo} onChange={(e) => setCosto(e.target.value)} type="number" placeholder="0" className="w-full p-7 bg-slate-50 rounded-[2.2rem] outline-none font-black border-2 border-transparent focus:border-blue-500/10 transition-all" />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[11px] font-black uppercase text-slate-400 ml-6 tracking-widest">PVP</label>
                      <input value={precio} onChange={(e) => setPrecio(e.target.value)} type="number" placeholder="0" className="w-full p-7 bg-slate-50 rounded-[2.2rem] outline-none font-black border-2 border-transparent focus:border-blue-500/10 transition-all" />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[11px] font-black uppercase text-slate-400 ml-6 tracking-widest">Stock</label>
                      <input value={stock} onChange={(e) => setStock(e.target.value)} type="number" placeholder="0" className="w-full p-7 bg-slate-50 rounded-[2.2rem] outline-none font-black border-2 border-transparent focus:border-blue-500/10 transition-all" />
                    </div>
                  </div>

                  {/* Sección 3: Selector de Tallas Restaurado */}
                  <div className="space-y-4">
                    <p className="text-[11px] font-black uppercase text-slate-400 ml-6 tracking-widest">Configuración de Tallas</p>
                    <div className="flex flex-wrap gap-2 p-6 bg-slate-50 rounded-[2.5rem] border border-slate-100">
                      {TALLAS_DISPONIBLES.map(talla => (
                        <button 
                          key={talla} 
                          onClick={() => toggleTalla(talla)}
                          className={`px-5 py-3 rounded-2xl text-[10px] font-black transition-all ${
                            tallasSel.includes(talla) 
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 scale-105' 
                            : 'bg-white text-slate-400 border border-slate-100 hover:border-blue-200'
                          }`}
                        >
                          {talla}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Sección 4: Modalidad Mayorista */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                     <div className="space-y-3">
                       <label className="text-[11px] font-black uppercase text-slate-400 ml-6 tracking-widest">Modalidad</label>
                       <select value={modalidadMayor} onChange={(e) => setModalidadMayor(e.target.value)} className="w-full p-6 bg-slate-50 rounded-[2rem] outline-none font-black border-2 border-transparent focus:border-blue-500/10 transition-all">
                          <option value="Al Detal">Venta al Detal</option>
                          <option value="Al Mayor">Venta al Mayor</option>
                       </select>
                     </div>
                     {modalidadMayor === "Al Mayor" && (
                       <div className="space-y-3 animate-in fade-in zoom-in duration-300">
                         <label className="text-[11px] font-black uppercase text-slate-400 ml-6 tracking-widest">Mínimo Mayor</label>
                         <input value={minimoMayor} onChange={(e) => setMinimoMayor(e.target.value)} type="number" placeholder="Cantidad mínima" className="w-full p-6 bg-blue-50/30 text-blue-700 rounded-[2rem] outline-none font-black border-2 border-blue-100" />
                       </div>
                     )}
                  </div>

                  {/* Sección 5: Ofertas */}
                  <div className="grid grid-cols-2 gap-8">
                    <button 
                      onClick={() => setEsOferta(!esOferta)}
                      className={`p-7 rounded-[2.5rem] flex justify-between items-center border-2 transition-all shadow-sm ${esOferta ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-transparent'}`}
                    >
                      <span className={`text-[11px] font-black uppercase tracking-widest ${esOferta ? 'text-red-600' : 'text-slate-400'}`}>¿Habilitar Oferta?</span>
                      <div className={`w-12 h-7 rounded-full relative transition-all ${esOferta ? 'bg-red-500' : 'bg-slate-300'}`}>
                        <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all ${esOferta ? 'left-6' : 'left-1'}`} />
                      </div>
                    </button>
                    {esOferta && (
                      <div className="relative group animate-in slide-in-from-left-6">
                        <input value={porcentaje} onChange={(e) => setPorcentaje(Number(e.target.value))} type="number" placeholder="Descuento %" className="w-full p-7 bg-red-50/50 text-red-600 rounded-[2.5rem] outline-none font-black border-2 border-red-100" />
                        <span className="absolute right-8 top-1/2 -translate-y-1/2 font-black text-red-200">%</span>
                      </div>
                    )}
                  </div>

                  {/* Sección 6: Galería Multimedia */}
                  <div className="p-10 bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200">
                    <div className="flex gap-4 overflow-x-auto pb-6 no-scrollbar">
                       {imagenes.length === 0 && <div className="h-24 w-full flex items-center justify-center text-slate-300 font-bold text-[10px] uppercase tracking-[0.3em] italic">Arrastra tus fotos aquí</div>}
                       {imagenes.map((img, i) => (
                         <div key={i} className="relative group shrink-0">
                           <img src={img} className="h-24 w-24 object-cover rounded-[1.5rem] shadow-xl border-4 border-white" alt="" />
                           <button onClick={() => setImagenes(imagenes.filter((_, idx) => idx !== i))} className="absolute -top-3 -right-3 bg-red-500 text-white w-8 h-8 rounded-full text-xs opacity-0 group-hover:opacity-100 transition-all shadow-lg hover:scale-110">✕</button>
                         </div>
                       ))}
                    </div>
                    <button onClick={() => fileInputRef.current?.click()} className="w-full py-5 bg-white text-blue-600 rounded-[2rem] text-[10px] font-black uppercase tracking-widest shadow-sm hover:shadow-xl transition-all active:scale-[0.98] border border-blue-50">
                      📸 Cargar Imágenes del Producto
                    </button>
                    <input type="file" multiple ref={fileInputRef} onChange={handleMultipleImages} className="hidden" />
                  </div>

                  {/* Acciones Finales */}
                  <div className="flex gap-8 mt-12">
                    <button onClick={cerrarModal} className="flex-1 py-7 font-black uppercase text-[11px] text-slate-400 hover:text-slate-600 tracking-[0.3em] transition-colors">Descartar</button>
                    <button onClick={guardarProducto} className="flex-[2.5] py-7 bg-blue-600 text-white rounded-[3rem] font-black uppercase text-[12px] shadow-2xl shadow-blue-200 hover:bg-blue-700 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3">
                      <span>💾</span> {editandoId ? "Actualizar Inventario" : "Finalizar y Guardar"}
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}