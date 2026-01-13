"use client";
import { useState, useRef, useMemo, ChangeEvent, useEffect, useCallback } from "react";
import { UserButton, useUser, useAuth } from "@clerk/nextjs";
import { motion, AnimatePresence } from "framer-motion";
import { getSupabaseClient } from "../lib/supabase";

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
  tallas?: string[];
  tipo_venta: string;
  modalidad_mayor: string;
  minimo_mayor?: number;
  user_id: string;
}

const CATEGORIAS = ["Todos", "Agotándose", "General", "Cosméticos", "Comida", "Ropa", "Joyería", "Limpieza"];

export default function Dashboard() {
  const { user, isLoaded } = useUser();
  const { getToken } = useAuth(); 
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [productos, setProductos] = useState<Producto[]>([]);

  // Estados de UI
  const [busqueda, setBusqueda] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("Todos");
  const [orden, setOrden] = useState("nombre");
  const [showModal, setShowModal] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [productoSeleccionado, setProductoSeleccionado] = useState<Producto | null>(null);
  const [fotoActual, setFotoActual] = useState(0);

  // Estados del Formulario
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [precio, setPrecio] = useState("");
  const [costo, setCosto] = useState("");
  const [stock, setStock] = useState("");
  const [imagenes, setImagenes] = useState<string[]>([]);
  const [esOferta, setEsOferta] = useState(false);
  const [porcentaje, setPorcentaje] = useState(0);
  const [categoria, setCategoria] = useState("General");
  const [tallaInput, setTallaInput] = useState("");
  const [tallas, setTallas] = useState<string[]>([]);
  const [tipoVenta, setTipoVenta] = useState("Unidad");
  const [modalidadMayor, setModalidadMayor] = useState("Al Detal");
  const [minimoMayor, setMinimoMayor] = useState("");

  // --- FUNCIONES CORREGIDAS (Ordenadas para evitar errores de hoisting) ---

  const cerrarModal = () => {
  setShowModal(false);
    setShowModal(false); setEditandoId(null); setNombre(""); setDescripcion(""); setPrecio(""); setCosto("");
    setStock(""); setImagenes([]); setEsOferta(false); setPorcentaje(0); setCategoria("General");
    setTallas([]); setTallaInput(""); setTipoVenta("Unidad"); setModalidadMayor("Al Detal"); setMinimoMayor("");
  }, []);

  const fetchProductos = useCallback(async () => {
    if (!user) return;
    try {
      const token = await getToken({ template: 'supabase' });
      const supabase = await getSupabaseClient(token);
      const { data, error } = await supabase
        .from('productos')
        .select('*')
        .order('nombre', { ascending: true });

      if (error) throw error;
      if (data) setProductos(data as Producto[]);
    } catch (error) {
      console.error("Error cargando productos:", error);
    }
  }, [user, getToken]);

  useEffect(() => {
    if (isLoaded && user) {
      fetchProductos();
    }
  }, [user, isLoaded, fetchProductos]);

  const stats = useMemo(() => {
    const inversionTotal = productos.reduce((acc, p) => acc + (Number(p.costo) * Number(p.stock)), 0);
    const ventaProyectada = productos.reduce((acc, p) => {
      const pFinal = p.oferta ? p.precio * (1 - p.descuento / 100) : p.precio;
      return acc + (pFinal * p.stock);
    }, 0);
    return {
      inversion: inversionTotal,
      ganancia: ventaProyectada - inversionTotal,
      bajoStock: productos.filter(p => p.stock <= 5).length,
      totalUnidades: productos.reduce((acc, p) => acc + Number(p.stock), 0)
    };
  }, [productos]);

  const productosFiltrados = useMemo(() => {
    let filtrados = productos.filter(p => p.nombre.toLowerCase().includes(busqueda.toLowerCase()));
    if (filtroCategoria === "Agotándose") filtrados = filtrados.filter(p => p.stock <= 5);
    else if (filtroCategoria !== "Todos") filtrados = filtrados.filter(p => p.categoria === filtroCategoria);

    return [...filtrados].sort((a, b) => {
      if (orden === "nombre") return a.nombre.localeCompare(b.nombre);
      if (orden === "precio-min") return a.precio - b.precio;
      if (orden === "precio-max") return b.precio - a.precio;
      return 0;
    });
  }, [productos, busqueda, orden, filtroCategoria]);

  const ajustarStock = async (id: string, cant: number) => {
    const producto = productos.find(p => p.id === id);
    if (!producto || !user) return;
    const nuevoStock = Math.max(0, Number(producto.stock) + cant);
    setProductos(prev => prev.map(p => p.id === id ? { ...p, stock: nuevoStock } : p));
    try {
      const token = await getToken({ template: 'supabase' });
      const supabase = await getSupabaseClient(token);
      const { error } = await supabase.from('productos').update({ stock: nuevoStock }).eq('id', id);
      if (error) throw error;
    } catch (error) {
      alert("Error: No se pudo sincronizar el stock.");
      fetchProductos();
    }
  };

  const borrarProducto = async (id: string) => {
    if (!confirm("¿Deseas eliminar este registro?")) return;
    try {
      const token = await getToken({ template: 'supabase' });
      const supabase = await getSupabaseClient(token);
      const { error } = await supabase.from('productos').delete().eq('id', id);
      if (error) throw error;
      fetchProductos();
    } catch (error) {
      alert("Error al eliminar");
    }
  };

  const handleMultipleImages = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => setImagenes(prev => [...prev, reader.result as string]);
      reader.readAsDataURL(file);
    });
  };

  const agregarTalla = () => {
    if (tallaInput.trim() && !tallas.includes(tallaInput.trim().toUpperCase())) {
      setTallas([...tallas, tallaInput.trim().toUpperCase()]);
      setTallaInput("");
    }
  };

  const guardarProducto = async () => {
    if (!user) return alert("Debes iniciar sesión");
    if (!nombre || !precio || !stock) return alert("Faltan datos críticos: Nombre, Precio y Stock son obligatorios");

    const datosBase = {
      nombre,
      descripcion,
      precio: Number(precio),
      costo: Number(costo) || 0,
      stock: Number(stock),
      oferta: esOferta,
      descuento: porcentaje,
      categoria,
      tallas,
      tipo_venta: tipoVenta,
      modalidad_mayor: modalidadMayor,
      minimo_mayor: modalidadMayor === "Al Mayor" ? Number(minimoMayor) : null,
      user_id: user.id, 
      imagenes: imagenes.length > 0 ? imagenes : ["https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600"],
    };

    try {
      const token = await getToken({ template: 'supabase' });
      if (!token) throw new Error("Sesión expirada");
      
      const supabase = await getSupabaseClient(token);

      if (editandoId) {
        const { error } = await supabase.from('productos').update(datosBase).eq('id', editandoId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('productos').insert([{
          ...datosBase,
          id: window.crypto.randomUUID()
        }]);
        if (error) throw error;
      }

      alert(editandoId ? "¡Producto actualizado!" : "¡Producto guardado con éxito!");
      fetchProductos(); 
      cerrarModal();    
    } catch (err: unknown) {
      const error = err as { message?: string };
      console.error("Error detallado:", error);
      alert(`Error al guardar: ${error.message || "Error desconocido"}`);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-20 text-slate-900 font-sans print:bg-white">
      <nav className="bg-white/80 backdrop-blur-md border-b sticky top-0 z-40 px-8 py-4 flex justify-between items-center shadow-sm print:hidden">
        <div className="flex items-center gap-3">
          <span className="text-3xl">📦</span>
          <h1 className="text-2xl font-black bg-gradient-to-r from-blue-700 via-indigo-600 to-purple-600 bg-clip-text text-transparent italic uppercase tracking-tighter">Store Virtual</h1>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => window.print()} className="p-2.5 bg-slate-100 rounded-xl hover:bg-slate-200 transition-all text-[10px] font-black uppercase px-5 border border-slate-200 shadow-sm">🖨️ Generar Reporte PDF</button>
          <UserButton afterSignOutUrl="/" />
        </div>
      </nav>

      <main className="p-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10 print:grid-cols-2 print:mb-4">
          <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col items-center">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Inversión Total</p>
            <p className="text-2xl font-black text-slate-900">${stats.inversion.toLocaleString()}</p>
          </div>
          <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col items-center">
            <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-1">Ganancia Proyectada</p>
            <p className="text-2xl font-black text-blue-600">${stats.ganancia.toLocaleString()}</p>
          </div>
          <div className={`p-6 rounded-[2.5rem] shadow-sm border flex flex-col items-center transition-colors ${stats.bajoStock > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-100'}`}>
            <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1">Por Agotarse</p>
            <p className="text-2xl font-black text-slate-900">{stats.bajoStock} items</p>
          </div>
          <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col items-center">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Unidades en Almacén</p>
            <p className="text-2xl font-black text-slate-900">{stats.totalUnidades}</p>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-6 mb-4 no-scrollbar print:hidden">
          {CATEGORIAS.map(cat => (
            <motion.button key={cat} whileHover={{ y: -2 }} whileTap={{ scale: 0.95 }} onClick={() => setFiltroCategoria(cat)} className={`px-6 py-2.5 rounded-full text-[10px] font-black transition-all border shadow-sm ${filtroCategoria === cat ? 'bg-blue-600 text-white border-blue-600' : (cat === "Agotándose" ? 'bg-red-50 text-red-600 border-red-100' : 'bg-white text-slate-500 border-slate-100')}`}>
              {cat.toUpperCase()}
            </motion.button>
          ))}
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-12 print:hidden">
          <div className="flex-1 max-w-xl">
            <h2 className="text-4xl font-black text-slate-800 mb-4 tracking-tight uppercase italic drop-shadow-sm">Gestión de Almacén</h2>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30 font-bold">🔍</span>
              <input type="text" placeholder="Buscar por nombre o descripción..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="w-full pl-12 pr-4 py-4 bg-white rounded-[2rem] border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500 shadow-sm outline-none transition-all text-slate-900" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <select value={orden} onChange={(e) => setOrden(e.target.value)} className="p-4 bg-white rounded-2xl border-none ring-1 ring-slate-200 font-bold text-xs shadow-sm cursor-pointer outline-none text-slate-900">
              <option value="nombre">Orden: A-Z</option>
              <option value="precio-min">Precio: Menor</option>
              <option value="precio-max">Precio: Mayor</option>
            </select>
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setShowModal(true)} className="px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-2xl font-black shadow-lg uppercase text-[10px] tracking-widest border border-blue-400/20">
              + Nuevo Registro
            </motion.button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          <AnimatePresence mode="popLayout">
            {productosFiltrados.map((prod) => (
              <motion.div key={prod.id} layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }} className="bg-white rounded-[2.5rem] overflow-hidden border border-slate-100 shadow-sm hover:shadow-2xl transition-all cursor-pointer group relative" onClick={() => { setProductoSeleccionado(prod); setFotoActual(0); }}>
                {prod.oferta && <div className="absolute top-4 left-4 z-20 bg-red-500 text-white text-[10px] font-black px-3 py-1 rounded-full shadow-lg ring-2 ring-white">{prod.descuento}% OFF</div>}
                <span className="absolute top-4 right-4 bg-white/90 backdrop-blur px-3 py-1 rounded-full text-[9px] font-black text-blue-600 z-20 uppercase border border-blue-50 shadow-sm">{prod.categoria}</span>
                <div className="h-56 w-full bg-slate-50 overflow-hidden relative">
                  {prod.stock <= 5 && (
                    <div className="absolute inset-0 bg-amber-500/10 backdrop-blur-[1px] flex items-center justify-center z-10">
                      <div className="bg-amber-500 text-white text-[9px] font-black px-4 py-1.5 rounded-full ring-2 ring-white shadow-lg animate-pulse">REPOSICIÓN</div>
                    </div>
                  )}
                  <img src={prod.imagenes[0]} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt="" />
                </div>
                <div className="p-6">
                  <h4 className="font-bold text-slate-800 text-lg truncate mb-1">{prod.nombre}</h4>
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-2xl font-black text-slate-900">${prod.oferta ? (prod.precio * (1 - prod.descuento / 100)).toFixed(0) : prod.precio}</span>
                  </div>
                  <div className="mt-4 p-3 bg-slate-50 rounded-2xl flex items-center justify-between print:hidden" onClick={e => e.stopPropagation()}>
                    <button onClick={() => ajustarStock(prod.id, -1)} className="w-8 h-8 flex items-center justify-center bg-white rounded-xl shadow-sm text-red-500 font-black hover:bg-red-500 hover:text-white transition-all border border-slate-100">−</button>
                    <div className="text-center">
                      <span className="block text-[8px] font-black text-slate-400 uppercase">Stock</span>
                      <span className={`text-sm font-black ${prod.stock <= 5 ? 'text-amber-600' : 'text-slate-700'}`}>{prod.stock}</span>
                    </div>
                    <button onClick={() => ajustarStock(prod.id, 1)} className="w-8 h-8 flex items-center justify-center bg-white rounded-xl shadow-sm text-blue-500 font-black hover:bg-blue-500 hover:text-white transition-all border border-slate-100">+</button>
                  </div>
                  <div className="mt-6 pt-4 border-t border-slate-50 flex justify-between items-center print:hidden" onClick={e => e.stopPropagation()}>
                    <span className="text-[9px] font-black text-green-600 bg-green-50 px-2 py-1 rounded-lg">Margen: ${prod.precio - prod.costo}</span>
                    <div className="flex gap-2">
                      <button onClick={() => { 
                        setEditandoId(prod.id); setNombre(prod.nombre); setDescripcion(prod.descripcion); setPrecio(prod.precio.toString()); setCosto(prod.costo.toString()); setStock(prod.stock.toString()); setCategoria(prod.categoria); setTallas(prod.tallas || []); setTipoVenta(prod.tipo_venta); setModalidadMayor(prod.modalidad_mayor); setMinimoMayor(prod.minimo_mayor?.toString() || ""); setShowModal(true); 
                      }} className="p-2 text-blue-600 bg-blue-50 rounded-xl hover:bg-blue-600 hover:text-white transition-all">✏️</button>
                      <button onClick={() => borrarProducto(prod.id)} className="p-2 text-red-600 bg-red-50 rounded-xl hover:bg-red-600 hover:text-white transition-all">🗑️</button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Modal de Detalle */}
        <AnimatePresence>
          {productoSeleccionado && (
            <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-md flex items-center justify-center z-50 p-4" onClick={() => setProductoSeleccionado(null)}>
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white w-full max-w-5xl rounded-[3rem] overflow-hidden flex flex-col md:flex-row h-[620px] shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="md:w-1/2 bg-black relative flex items-center justify-center h-full">
                  <img src={productoSeleccionado.imagenes[fotoActual]} className="w-full h-full object-contain" alt="" />
                  {productoSeleccionado.imagenes.length > 1 && (
                    <div className="absolute inset-x-6 flex justify-between">
                      <button onClick={(e) => { e.stopPropagation(); setFotoActual(v => (v > 0 ? v - 1 : productoSeleccionado.imagenes.length - 1)); }} className="p-4 bg-white/10 text-white rounded-full hover:bg-white/20 transition-all">◀</button>
                      <button onClick={(e) => { e.stopPropagation(); setFotoActual(v => (v < productoSeleccionado.imagenes.length - 1 ? v + 1 : 0)); }} className="p-4 bg-white/10 text-white rounded-full hover:bg-white/20 transition-all">▶</button>
                    </div>
                  )}
                </div>
                <div className="md:w-1/2 p-12 flex flex-col bg-white overflow-y-auto h-full text-slate-900">
                  <div className="flex justify-between items-start">
                    <span className="px-4 py-1.5 bg-blue-50 text-blue-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-blue-100">{productoSeleccionado.categoria}</span>
                    <button onClick={() => setProductoSeleccionado(null)} className="text-slate-300 hover:text-red-500 font-bold text-xl">✕</button>
                  </div>
                  <h3 className="text-3xl font-black text-slate-900 mt-6 leading-tight">{productoSeleccionado.nombre}</h3>
                  <div className="grid grid-cols-2 gap-4 mt-8">
                    <div className="bg-slate-50 p-6 rounded-[2.5rem] border border-slate-100 text-center">
                      <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Precio Público</p>
                      <p className="text-3xl font-black text-slate-900">${productoSeleccionado.precio}</p>
                    </div>
                    <div className="bg-slate-50 p-6 rounded-[2.5rem] border border-slate-100 text-center">
                      <p className="text-[10px] font-black text-green-500 uppercase mb-1">Costo Almacén</p>
                      <p className="text-3xl font-black text-green-600">${productoSeleccionado.costo}</p>
                    </div>
                  </div>
                  <div className="mt-8 space-y-3">
                    <div className="p-5 bg-orange-50 rounded-[2rem] border border-orange-100 flex justify-between items-center shadow-sm">
                      <span className="text-[10px] text-orange-400 font-black uppercase tracking-widest">Forma de Venta</span>
                      <span className="text-orange-600 font-black text-xs italic uppercase">Por {productoSeleccionado.tipo_venta}</span>
                    </div>
                    <div className="p-5 bg-purple-50 rounded-[2rem] border border-purple-100 flex justify-between items-center shadow-sm">
                      <span className="text-[10px] text-purple-400 font-black uppercase tracking-widest">Modalidad</span>
                      <span className="text-purple-600 font-black text-xs italic uppercase">
                        {productoSeleccionado.modalidad_mayor}
                        {productoSeleccionado.modalidad_mayor === "Al Mayor" && ` (Mín: ${productoSeleccionado.minimo_mayor} u.)`}
                      </span>
                    </div>
                  </div>
                  <div className="mt-8">
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-2 ml-2 tracking-widest">Notas Internas</p>
                    <div className="bg-slate-50 p-6 rounded-[2rem] text-gray-600 text-sm italic border border-slate-100">
                      {productoSeleccionado.descripcion || "Sin descripción registrada."}
                    </div>
                  </div>
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => {
                    const mensaje = `*Info Almacén:* ${productoSeleccionado.nombre} \n💰 *Precio:* $${productoSeleccionado.precio} \n📦 *Stock:* ${productoSeleccionado.stock} u.`;
                    window.open(`https://wa.me/?text=${encodeURIComponent(mensaje)}`, '_blank');
                  }} className="mt-8 py-5 bg-green-500 text-white rounded-[2rem] font-black uppercase text-[10px] tracking-widest shadow-xl flex items-center justify-center gap-3">
                    📱 Enviar Reporte WhatsApp
                  </motion.button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Modal de Registro */}
        <AnimatePresence>
          {showModal && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4 overflow-y-auto">
              <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-white w-full max-w-xl rounded-[3rem] p-10 shadow-2xl my-auto border border-slate-100">
                <h3 className="text-2xl font-black mb-8 uppercase italic tracking-tight text-slate-800">Ficha de Registro Maestro</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-[9px] font-black uppercase text-slate-400 ml-2 tracking-widest">Rubro del Producto</label>
                    <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="w-full p-4 bg-slate-50 rounded-2xl border-none ring-1 ring-slate-200 mt-1 font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all text-slate-900">
                      {CATEGORIAS.filter(c => c !== "Todos" && c !== "Agotándose").map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  
                  {categoria === "Ropa" && (
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-5 bg-indigo-50 rounded-[2rem] border border-indigo-100 shadow-inner">
                      <p className="text-[9px] font-black text-indigo-400 mb-2 uppercase tracking-widest ml-2">Gestión de Tallas</p>
                      <div className="flex gap-2 mb-3">
                        <input value={tallaInput} onChange={(e) => setTallaInput(e.target.value)} placeholder="Ej: M, L, 42..." className="flex-1 p-3 rounded-xl ring-1 ring-indigo-200 outline-none text-sm font-bold uppercase shadow-sm text-slate-900" />
                        <button onClick={agregarTalla} className="px-4 bg-indigo-600 text-white rounded-xl font-bold shadow-md hover:bg-indigo-700">+</button>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {tallas.map(t => <span key={t} onClick={() => setTallas(tallas.filter(x => x !== t))} className="px-3 py-1.5 bg-white text-indigo-600 rounded-lg text-[10px] font-black border border-indigo-200 cursor-pointer hover:text-red-500 shadow-sm transition-all">{t} ✕</span>)}
                      </div>
                    </motion.div>
                  )}

                  <div className="p-6 bg-slate-50 rounded-[2.5rem] border border-slate-200 space-y-5 shadow-inner">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Configuración de Venta</p>
                    <div className="grid grid-cols-3 gap-2">
                      {["Unidad", "Docena", "Bulto"].map(modo => (
                        <button key={modo} onClick={() => setTipoVenta(modo)} className={`p-3 rounded-xl text-[9px] font-black transition-all ${tipoVenta === modo ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-blue-600 border border-blue-100'}`}>POR {modo.toUpperCase()}</button>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {["Al Detal", "Al Mayor"].map(modo => (
                        <button key={modo} onClick={() => setModalidadMayor(modo)} className={`p-3 rounded-xl text-[9px] font-black transition-all ${modalidadMayor === modo ? 'bg-purple-600 text-white shadow-md' : 'bg-white text-purple-600 border border-purple-100'}`}>{modo.toUpperCase()}</button>
                      ))}
                    </div>
                    {modalidadMayor === "Al Mayor" && (
                      <input type="number" value={minimoMayor} onChange={(e) => setMinimoMayor(e.target.value)} placeholder="Mínimo de unidades..." className="w-full p-4 bg-white rounded-2xl ring-1 ring-purple-100 text-xs font-bold outline-none text-slate-900" />
                    )}
                  </div>

                  <div onClick={() => fileInputRef.current?.click()} className="w-full h-24 bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2rem] flex items-center justify-center p-4 cursor-pointer overflow-x-auto">
                    {imagenes.map((img, i) => <img key={i} src={img} className="h-full rounded-xl mr-2 shadow-sm" alt="" />)}
                    {imagenes.length === 0 && <span className="text-[10px] font-black uppercase text-slate-400">📸 Subir Fotos</span>}
                  </div>
                  <input type="file" ref={fileInputRef} onChange={handleMultipleImages} multiple accept="image/*" className="hidden" />

                  <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre del artículo" className="w-full p-4 bg-slate-50 rounded-2xl ring-1 ring-slate-200 font-bold outline-none text-slate-900" />
                  <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Descripción..." className="w-full p-4 bg-slate-50 rounded-2xl h-24 resize-none ring-1 ring-slate-200 italic text-sm outline-none text-slate-900" />

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-[8px] font-black ml-3 uppercase text-green-600">Costo $</label>
                      <input value={costo} onChange={(e) => setCosto(e.target.value)} type="number" className="p-4 bg-green-50 rounded-2xl w-full ring-1 ring-green-200 font-bold outline-none text-slate-900" />
                    </div>
                    <div>
                      <label className="text-[8px] font-black ml-3 uppercase text-blue-600">Venta $</label>
                      <input value={precio} onChange={(e) => setPrecio(e.target.value)} type="number" className="p-4 bg-blue-50 rounded-2xl w-full ring-1 ring-blue-200 font-bold outline-none text-slate-900" />
                    </div>
                    <div>
                      <label className="text-[8px] font-black ml-3 uppercase text-slate-500">Stock</label>
                      <input value={stock} onChange={(e) => setStock(e.target.value)} type="number" className="p-4 bg-slate-100 rounded-2xl w-full ring-1 ring-slate-200 font-bold outline-none text-slate-900" />
                    </div>
                  </div>

                  <div className={`p-6 rounded-[2.5rem] shadow-sm ${esOferta ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white' : 'bg-slate-50 text-slate-500 border border-slate-200'}`}>
                    <div className="flex justify-between items-center font-black text-[10px] uppercase">
                      <span>¿Activar Promoción?</span>
                      <input type="checkbox" checked={esOferta} onChange={(e) => setEsOferta(e.target.checked)} className="w-5 h-5 accent-white cursor-pointer" />
                    </div>
                    {esOferta && (
                      <div className="mt-4 text-center">
                        <input type="range" min="0" max="100" value={porcentaje} onChange={(e) => setPorcentaje(Number(e.target.value))} className="w-full accent-white" />
                        <div className="font-black text-2xl mt-1">{porcentaje}% OFF</div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-10 flex gap-4">
                  <button onClick={cerrarModal} className="flex-1 text-[10px] font-black uppercase text-slate-400 hover:text-red-500 transition-colors">Cancelar</button>
                  <button onClick={guardarProducto} className="flex-[2] py-5 bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl">
                    Guardar en Registro
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}