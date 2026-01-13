"use client";
import { useState, useRef, useMemo, ChangeEvent, useEffect } from "react";
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
  tipoventa: string;
  modalidadmayor: string;
  minimomayor?: number;
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
  const [tallas, setTallas] = useState<string[]>([]);
  const [tipoVenta, setTipoVenta] = useState("Unidad");
  const [modalidadMayor, setModalidadMayor] = useState("Al Detal");
  const [minimoMayor, setMinimoMayor] = useState("");

  useEffect(() => {
    if (isLoaded && user) fetchProductos();
  }, [user, isLoaded]);

  const fetchProductos = async () => {
    if (!user) return;
    try {
      const token = await getToken({ template: 'supabase' });
      const supabase = await getSupabaseClient(token);
      const { data, error } = await supabase.from('productos').select('*').order('nombre', { ascending: true });
      if (error) throw error;
      if (data) setProductos(data as Producto[]);
    } catch (err) {
      console.error("Error al cargar productos:", err);
    }
  };

  const guardarProducto = async () => {
    if (!user) return alert("Debes iniciar sesión");
    if (!nombre || !precio || !stock) return alert("Faltan datos críticos");

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
          id: window.crypto.randomUUID()
        }]);
        if (error) throw error;
      }

      alert("Éxito al guardar");
      fetchProductos(); 
      cerrarModal();    
    } catch (err: unknown) {
      const error = err as Error;
      alert(`Error: ${error.message}`);
    }
  };

  const borrarProducto = async (id: string) => {
    if (!confirm("¿Eliminar registro?")) return;
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
      console.error("Error al ajustar stock:", err); 
    }
  };

  const cerrarModal = () => {
    setShowModal(false); setEditandoId(null); setNombre(""); setDescripcion(""); setPrecio(""); setCosto("");
    setStock(""); setImagenes([]); setEsOferta(false); setCategoria("General");
    setTallas([]); setPorcentaje(0);
  };

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

  const handleMultipleImages = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => setImagenes(prev => [...prev, reader.result as string]);
      reader.readAsDataURL(file);
    });
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-20 text-slate-900 print:bg-white">
      <nav className="bg-white/80 backdrop-blur-md border-b sticky top-0 z-40 px-8 py-4 flex justify-between items-center print:hidden">
        <div className="flex items-center gap-3">
          <span className="text-3xl">📦</span>
          <h1 className="text-2xl font-black bg-gradient-to-r from-blue-700 to-purple-600 bg-clip-text text-transparent italic uppercase">Store Virtual</h1>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => window.print()} className="p-2.5 bg-slate-100 rounded-xl text-[10px] font-black uppercase px-5">🖨️ PDF</button>
          <UserButton afterSignOutUrl="/" />
        </div>
      </nav>

      <main className="p-8 max-w-7xl mx-auto">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10 print:grid-cols-2">
          <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 text-center">
            <p className="text-[10px] font-black text-slate-400 uppercase">Inversión</p>
            <p className="text-2xl font-black">${stats.inversion.toLocaleString()}</p>
          </div>
          <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 text-center">
            <p className="text-[10px] font-black text-blue-500 uppercase">Ganancia</p>
            <p className="text-2xl font-black text-blue-600">${stats.ganancia.toLocaleString()}</p>
          </div>
          <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 text-center">
            <p className="text-[10px] font-black text-amber-600 uppercase">Stock Bajo</p>
            <p className="text-2xl font-black">{stats.bajoStock} items</p>
          </div>
          <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 text-center">
            <p className="text-[10px] font-black text-slate-400 uppercase">Total Unidades</p>
            <p className="text-2xl font-black">{stats.totalUnidades}</p>
          </div>
        </div>

        {/* Categorías */}
        <div className="flex gap-2 overflow-x-auto pb-6 no-scrollbar print:hidden">
          {CATEGORIAS.map(cat => (
            <button key={cat} onClick={() => setFiltroCategoria(cat)} className={`px-6 py-2 rounded-full text-[10px] font-black border transition-all ${filtroCategoria === cat ? 'bg-blue-600 text-white shadow-lg' : 'bg-white text-slate-400 hover:border-blue-200'}`}>{cat.toUpperCase()}</button>
          ))}
        </div>

        {/* Buscador */}
        <div className="flex flex-col lg:flex-row justify-between gap-6 mb-12 print:hidden">
          <input type="text" placeholder="Buscar..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="flex-1 p-4 bg-white rounded-[2rem] shadow-sm outline-none" />
          <div className="flex gap-3">
            <select value={orden} onChange={(e) => setOrden(e.target.value)} className="p-4 bg-white rounded-2xl font-bold text-xs outline-none">
              <option value="nombre">A-Z</option>
              <option value="precio-min">Precio Min</option>
              <option value="precio-max">Precio Max</option>
            </select>
            <button onClick={() => setShowModal(true)} className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-[10px]">+ Nuevo</button>
          </div>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {productosFiltrados.map((prod) => (
            <div key={prod.id} className="bg-white rounded-[2.5rem] overflow-hidden border border-slate-100 shadow-sm hover:shadow-xl transition-all cursor-pointer group" onClick={() => setProductoSeleccionado(prod)}>
              <div className="h-56 relative bg-slate-50">
                <img src={prod.imagenes[0]} className="w-full h-full object-cover" alt="" />
                {prod.oferta && <div className="absolute top-4 left-4 bg-red-500 text-white text-[9px] font-black px-3 py-1 rounded-full">{prod.descuento}% OFF</div>}
              </div>
              <div className="p-6">
                <h4 className="font-bold text-lg truncate">{prod.nombre}</h4>
                <p className="text-2xl font-black mt-2">${prod.precio}</p>
                <div className="mt-4 flex justify-between items-center" onClick={e => e.stopPropagation()}>
                  <button onClick={() => ajustarStock(prod.id, -1)} className="w-8 h-8 bg-slate-100 rounded-lg font-black">-</button>
                  <span className="font-black text-sm">{prod.stock}</span>
                  <button onClick={() => ajustarStock(prod.id, 1)} className="w-8 h-8 bg-slate-100 rounded-lg font-black">+</button>
                </div>
                <div className="mt-4 pt-4 border-t flex justify-end gap-2" onClick={e => e.stopPropagation()}>
                  <button onClick={() => { 
                    setEditandoId(prod.id); setNombre(prod.nombre); setDescripcion(prod.descripcion); setPrecio(prod.precio.toString()); setCosto(prod.costo.toString()); setStock(prod.stock.toString()); setCategoria(prod.categoria); setTallas(prod.tallas || []); setEsOferta(prod.oferta); setPorcentaje(prod.descuento); setImagenes(prod.imagenes); setShowModal(true); 
                  }} className="p-2 bg-blue-50 text-blue-600 rounded-lg">✏️</button>
                  <button onClick={() => borrarProducto(prod.id)} className="p-2 bg-red-50 text-red-600 rounded-lg">🗑️</button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Modal Detalle */}
        <AnimatePresence>
          {productoSeleccionado && (
            <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setProductoSeleccionado(null)}>
              <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-white w-full max-w-4xl rounded-[3rem] overflow-hidden flex flex-col md:flex-row h-[600px]" onClick={e => e.stopPropagation()}>
                <div className="md:w-1/2 bg-black flex items-center justify-center">
                  <img src={productoSeleccionado.imagenes[fotoActual]} className="max-h-full object-contain" alt="" />
                </div>
                <div className="md:w-1/2 p-10 overflow-y-auto bg-white flex flex-col">
                  <div className="flex justify-between">
                    <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-black uppercase">{productoSeleccionado.categoria}</span>
                    <button onClick={() => setProductoSeleccionado(null)} className="font-bold">✕</button>
                  </div>
                  <h3 className="text-3xl font-black mt-4">{productoSeleccionado.nombre}</h3>
                  <div className="grid grid-cols-2 gap-4 mt-6">
                    <div className="bg-slate-50 p-4 rounded-2xl text-center">
                      <p className="text-[9px] font-black text-slate-400 uppercase">Precio</p>
                      <p className="text-2xl font-black">${productoSeleccionado.precio}</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl text-center">
                      <p className="text-[9px] font-black text-slate-400 uppercase">Stock</p>
                      <p className="text-2xl font-black">{productoSeleccionado.stock}</p>
                    </div>
                  </div>
                  <button onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(productoSeleccionado.nombre + ' - $' + productoSeleccionado.precio)}`)} className="w-full mt-auto py-4 bg-green-500 text-white rounded-2xl font-black uppercase text-[10px]">📱 WhatsApp Report</button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Modal Registro */}
        <AnimatePresence>
          {showModal && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
              <motion.div initial={{ y: 50 }} animate={{ y: 0 }} className="bg-white w-full max-w-xl rounded-[3rem] p-8 shadow-2xl my-auto">
                <h3 className="text-xl font-black mb-6 uppercase">Registro de Producto</h3>
                <div className="space-y-4">
                  <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold">
                    {CATEGORIAS.filter(c => c !== "Todos").map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre" className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold" />
                  <div className="grid grid-cols-3 gap-3">
                    <input value={costo} onChange={(e) => setCosto(e.target.value)} type="number" placeholder="Costo" className="p-4 bg-slate-50 rounded-2xl outline-none font-bold" />
                    <input value={precio} onChange={(e) => setPrecio(e.target.value)} type="number" placeholder="Venta" className="p-4 bg-slate-50 rounded-2xl outline-none font-bold" />
                    <input value={stock} onChange={(e) => setStock(e.target.value)} type="number" placeholder="Stock" className="p-4 bg-slate-50 rounded-2xl outline-none font-bold" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 rounded-2xl flex justify-between items-center">
                      <span className="text-[10px] font-black uppercase">¿Oferta?</span>
                      <input type="checkbox" checked={esOferta} onChange={(e) => setEsOferta(e.target.checked)} />
                    </div>
                    {esOferta && <input value={porcentaje} onChange={(e) => setPorcentaje(Number(e.target.value))} type="number" placeholder="%" className="p-4 bg-red-50 rounded-2xl font-bold" />}
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl">
                    <div className="flex gap-2 overflow-x-auto mb-2">
                       {imagenes.map((img, i) => <img key={i} src={img} className="h-12 w-12 object-cover rounded-lg" alt="" />)}
                    </div>
                    <button onClick={() => fileInputRef.current?.click()} className="w-full py-2 bg-slate-200 rounded-xl text-[10px] font-black uppercase">Añadir Fotos</button>
                    <input type="file" multiple ref={fileInputRef} onChange={handleMultipleImages} className="hidden" />
                  </div>
                  <div className="flex gap-4 mt-8">
                    <button onClick={cerrarModal} className="flex-1 font-black uppercase text-[10px] text-slate-400">Cancelar</button>
                    <button onClick={guardarProducto} className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-[10px]">Guardar</button>
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