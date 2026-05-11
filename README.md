# MediConnect Admin

Panel administrativo separado para MediConnect.

## Archivos

| Archivo | Función |
|---|---|
| `index.html` | Estructura del panel admin |
| `admin.css` | Estilos del dashboard administrativo |
| `admin.js` | Conexión a Supabase y lógica del panel |

## Configuración

1. Abre `admin.js`.
2. Reemplaza:

```js
const SUPABASE_KEY = 'REEMPLAZA_AQUI_TU_SUPABASE_ANON_KEY';
```

por tu anon public key de Supabase.

## Tablas usadas

El panel usa las mismas tablas principales de MediConnect:

- `usuarios`
- `donaciones`

Opcionalmente usa:

- `solicitudes_validador`

```sql
create table solicitudes_validador (
  id uuid default gen_random_uuid() primary key,
  usuario_id uuid,
  nombre text,
  email text,
  estado text default 'pendiente',
  created_at timestamp default now()
);
```

## Usuario administrador

Crea o actualiza un usuario con rol `admin` o `validador`.

```sql
update usuarios
set rol = 'admin'
where email = 'TU_CORREO@EJEMPLO.COM';
```

## Repositorio sugerido

Nombre recomendado:

```text
mediconnect-admin
```

Este repositorio será independiente del proyecto de usuario final, pero podrá conectarse al mismo Supabase.
