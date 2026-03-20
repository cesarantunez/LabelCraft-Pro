# BUSINESS_LOGIC.md - LabelCraft Pro

> Generado por SaaS Factory | Fecha: 2026-03-19

## 1. Problema de Negocio

**Dolor:** Las aplicaciones lideres de etiquetado e inventario (Avery, Label LIVE, BarTender, MarkMagic, Loftware, etc.) sufren de interfaces anticuadas, lentitud extrema en impresion por lotes (Label LIVE tarda 10min en 100 etiquetas), errores ambiguos sin solucion clara, curvas de aprendizaje de horas/dias, y dependencia de servicios cloud con suscripciones costosas. Los equipos de almacen, operaciones y pequenos negocios pierden horas diarias luchando con herramientas que deberian simplificar su trabajo.

**Costo actual:**
- Tiempo perdido: 10+ minutos por lote de 100 etiquetas (Label LIVE)
- Setup inicial: horas o dias de configuracion (BarTender, Unicommerce, SOS Inventory)
- Costos recurrentes: suscripciones mensuales de $50-$500+ USD
- Errores manuales: duplicacion de datos, SKUs incorrectos, stock desactualizado
- Frustracion: equipos evitan usar la herramienta y regresan a procesos manuales

## 2. Solucion

**Propuesta de valor:** Una PWA de diseno de etiquetas, generacion de codigos de barras/QR e inventario basico que funciona 100% offline, se instala en cualquier dispositivo, y es gratuita.

**Flujo principal (Happy Path):**
1. Usuario instala la PWA y completa onboarding en <60 segundos (nombre del negocio, moneda, primera plantilla)
2. Agrega productos manualmente o importa desde Excel/CSV con mapeo de columnas
3. Abre el editor WYSIWYG, disena etiqueta arrastrando elementos (texto, codigos de barras, QR, imagenes, formas) sobre un canvas
4. Selecciona productos, genera PDF o imprime directamente — 100+ etiquetas en menos de 1 minuto
5. Escanea codigos con la camara del dispositivo para buscar productos, registrar movimientos de inventario, o imprimir etiquetas rapidas
6. Consulta reportes de inventario, stock bajo, movimientos y valor total — exporta a PDF/Excel/CSV

## 3. Usuario Objetivo

**Rol primario:** Gerente de Operaciones / Encargado de Almacen de PYME
**Rol secundario:** Dueno de pequeno negocio (tienda, farmacia, ferreteria, bodega)
**Contexto:** Persona que necesita etiquetar productos, llevar inventario basico, y no tiene presupuesto ni tiempo para soluciones enterprise. Quiere algo que "simplemente funcione" sin internet, sin suscripciones, sin configuracion compleja.

## 4. Arquitectura de Datos

**Input:**
- Productos: nombre, SKU, descripcion, categoria, precio, costo, stock, codigo de barras, imagen
- Plantillas de etiquetas: dimensiones, elementos del canvas (texto, barcode, QR, imagenes, formas)
- Movimientos de inventario: tipo (entrada/salida/ajuste/devolucion), cantidad, razon
- Archivos Excel/CSV para importacion masiva de productos
- Escaneo de codigos via camara del dispositivo
- Configuracion del negocio: nombre, logo, moneda, formato SKU

**Output:**
- Etiquetas impresas (directa a impresora via window.print)
- PDF de etiquetas en lote (jsPDF)
- Reportes en PDF, Excel y CSV (inventario, stock bajo, movimientos, valor)
- Backup completo de la base de datos (.sqlite)
- Productos exportados a Excel/CSV

**Storage (SQLite local via sql.js + IndexedDB):**
- `products`: Catalogo de productos con SKU, precios, stock, codigos de barras
- `categories`: Categorias de productos con color e icono
- `label_templates`: Plantillas de etiquetas con canvas serializado como JSON
- `print_history`: Historial de impresiones
- `inventory_movements`: Entradas, salidas, ajustes, devoluciones
- `app_settings`: Configuracion key-value de la aplicacion
- `_migrations`: Control de versiones del esquema de base de datos

## 5. KPI de Exito

**Metrica principal:** Generar e imprimir 100+ etiquetas en menos de 1 minuto (vs 10 minutos de Label LIVE)

**Metricas secundarias:**
- Onboarding completado en <60 segundos
- Cero errores ambiguos: cada error muestra mensaje claro en espanol con accion sugerida
- App funcional 100% offline despues de la primera carga
- Importacion de 1000+ productos desde Excel en <10 segundos

## 6. Especificacion Tecnica

### Stack Confirmado (Offline-First, NO Cloud)
- **Framework:** React 18+ con TypeScript
- **Build Tool:** Vite 5+
- **Base de datos:** SQLite via sql.js (WASM) con persistencia en IndexedDB
- **PWA:** Workbox para Service Worker
- **Codigos de barras:** bwip-js (1D/2D) + qrcode (QR)
- **Editor:** Canvas API nativo (HTML5 Canvas) — WYSIWYG
- **Exportacion:** jsPDF (PDF) + SheetJS/xlsx (Excel) + html2canvas
- **Escaner:** html5-qrcode (camara del dispositivo)
- **Impresion:** window.print() con CSS @media print
- **Estilos:** Tailwind CSS 3+ con paleta dark luxury custom
- **Estado global:** Zustand
- **Routing:** React Router v6
- **Iconos:** Lucide React
- **Tipografia:** Inter (UI) + JetBrains Mono (datos/codigos) — local, no CDN

### Modulos a Implementar
```
src/
├── pages/
│   ├── Dashboard          # KPIs, graficos, accesos rapidos
│   ├── Products           # CRUD completo, busqueda, filtros, bulk actions
│   ├── Editor             # Canvas WYSIWYG (modulo CORE)
│   ├── Print              # Impresion por lotes con Web Workers
│   ├── Scanner            # Escaneo con camara, busqueda, movimiento rapido
│   ├── Movements          # Registro de entradas/salidas/ajustes
│   ├── Reports            # 5+ reportes exportables
│   ├── Data               # Import/Export Excel, backup/restore SQLite
│   ├── Settings           # Config del negocio, moneda, DB, tema
│   └── Onboarding         # Wizard 3 pasos para primera vez
```

### Paleta de Colores
```
Fondo principal:      #0A0A0A  (negro profundo)
Acento primario:      #C47A3A  (cobre / rose gold)
Fondo secundario:     #8B6161  (mauve oscuro)
Texto principal:      #FFFFFF
Texto secundario:     #D4D4D4
Superficies/cards:    #1A1A1A
Bordes:               #2A2A2A
Exito:                #4ADE80
Error:                #F87171
Warning:              #FBBF24
```

### Proximos Pasos
1. [ ] Setup proyecto: Vite + React 18 + TypeScript + Tailwind
2. [ ] Configurar paleta de colores y tipografia local
3. [ ] Implementar DatabaseManager (sql.js + IndexedDB + migraciones)
4. [ ] Crear layout base (Sidebar + Header + routing)
5. [ ] Componentes UI base (Button, Input, Modal, Toast, etc.)
6. [ ] Dashboard con KPIs
7. [ ] Productos CRUD completo
8. [ ] Editor de etiquetas WYSIWYG (modulo CORE)
9. [ ] Impresion por lotes con Web Workers
10. [ ] Escaner con camara
11. [ ] Movimientos de inventario
12. [ ] Reportes y exportacion
13. [ ] Import/Export datos + backup
14. [ ] Configuracion
15. [ ] Onboarding wizard
16. [ ] Configurar PWA (manifest + Service Worker + Workbox)
17. [ ] Testing offline completo
