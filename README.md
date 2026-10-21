# LeadRadar 🎯 (Buscador Web & Scraper Comercial)

Plataforma integral para búsqueda, extracción inteligente, auditoría web y prospección de clientes potenciales mediante scraping de Google Maps y automatización de WhatsApp.

---

## 🚀 Despliegue Rápido con Docker (Recomendado)

En cualquier computadora con **Docker** y **Docker Compose** instalado:

### 1. Clonar el repositorio
```bash
git clone https://github.com/Facuelpillo08/GETweb.git
cd GETweb
```

### 2. Configurar variables de entorno (Opcional)
```bash
cp .env.example .env
```
*(Si no lo creas, tomará el puerto `3001` por defecto).*

### 3. Levantar la aplicación
```bash
docker compose up -d --build
```

¡Y listo! La aplicación compilará el frontend y el backend automáticamente.
- **Panel Web:** [http://localhost:3001](http://localhost:3001)
- **API Health Check:** [http://localhost:3001/api/health](http://localhost:3001/api/health)

---

## 🛠️ Comandos útiles con Docker

- **Ver logs en tiempo real (Scraper / WhatsApp):**
  ```bash
  docker compose logs -f
  ```
- **Detener el contenedor:**
  ```bash
  docker compose down
  ```
- **Reiniciar:**
  ```bash
  docker compose restart
  ```

---

## 💻 Ejecución en Desarrollo Local (Sin Docker)

Requisitos: Node.js 20+ instalado.

```bash
# 1. Instalar dependencias
npm install

# 2. Iniciar Backend y Frontend en paralelo
npm run dev:all
```

- **Frontend:** [http://localhost:5173](http://localhost:5173)
- **Backend:** [http://localhost:3001](http://localhost:3001)

---

## 📁 Persistencia de Datos
Los datos del CRM, el historial de clientes contactados y las sesiones de WhatsApp se almacenan de forma permanente en la carpeta `server/data/`, la cual está vinculada al host para que nunca se pierda tu información al reiniciar o reconstruir los contenedores.
