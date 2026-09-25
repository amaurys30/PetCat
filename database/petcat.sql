-- ═══════════════════════════════════════════════════════════════════════════
--  🐾 PetCat — Base de Datos Completa
--  Plataforma Digital para Servicios de Mascotas — Sincelejo, Sucre
--  CECAR 2026 | MySQL 8.0+ | Prisma ORM compatible
--
--  Dominios:
--    1. Usuarios y autenticación
--    2. Negocios, sucursales y equipo
--    3. Planes y suscripciones
--    4. Mascotas y salud
--    5. Servicios y citas
--    6. Inventario
--    7. Pagos y compras
--    8. Comunicación, notificaciones e IA
--    9. Comunidad y reseñas
--   10. Auditoría y configuración
-- ═══════════════════════════════════════════════════════════════════════════

CREATE DATABASE IF NOT EXISTS petcat_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE petcat_db;

SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = 'STRICT_TRANS_TABLES,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO';


-- ═══════════════════════════════════════════════════════════════════════════
--  DOMINIO 1: USUARIOS Y AUTENTICACIÓN
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE usuarios (
    id_usuario       INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    nombre           VARCHAR(80)     NOT NULL,
    apellido         VARCHAR(80)     NOT NULL,
    email            VARCHAR(150)    NOT NULL,
    password_hash    VARCHAR(255)    NOT NULL,
    telefono         VARCHAR(20)     NULL,
    foto_url         VARCHAR(500)    NULL,
    tipo_usuario     ENUM('cliente','negocio','admin') NOT NULL DEFAULT 'cliente',
    -- Verificación y seguridad
    email_verificado     BOOLEAN         NOT NULL DEFAULT FALSE,
    telefono_verificado  BOOLEAN         NOT NULL DEFAULT FALSE,
    token_verificacion   VARCHAR(100)    NULL,
    token_recuperacion   VARCHAR(100)    NULL,
    token_expiracion     DATETIME        NULL,
    intentos_login       TINYINT         NOT NULL DEFAULT 0,
    bloqueado_hasta      DATETIME        NULL,
    -- Preferencias
    idioma           VARCHAR(5)      NOT NULL DEFAULT 'es',
    zona_horaria     VARCHAR(50)     NOT NULL DEFAULT 'America/Bogota',
    notif_email      BOOLEAN         NOT NULL DEFAULT TRUE,
    notif_push       BOOLEAN         NOT NULL DEFAULT TRUE,
    notif_whatsapp   BOOLEAN         NOT NULL DEFAULT TRUE,
    -- Estado
    activo           BOOLEAN         NOT NULL DEFAULT TRUE,
    ultimo_acceso    DATETIME        NULL,
    fecha_registro   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id_usuario),
    UNIQUE KEY uq_usuarios_email (email),
    INDEX idx_usuarios_tipo (tipo_usuario),
    INDEX idx_usuarios_activo (activo),
    INDEX idx_usuarios_email_verificado (email_verificado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Tabla central de usuarios: clientes dueños de mascotas y administradores de negocios';


CREATE TABLE sesiones (
    id_sesion        BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    id_usuario       INT UNSIGNED    NOT NULL,
    token            VARCHAR(500)    NOT NULL,
    refresh_token    VARCHAR(500)    NULL,
    dispositivo      VARCHAR(200)    NULL,
    ip_address       VARCHAR(45)     NULL,
    user_agent       TEXT            NULL,
    activa           BOOLEAN         NOT NULL DEFAULT TRUE,
    expira_en        DATETIME        NOT NULL,
    fecha_creacion   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id_sesion),
    INDEX idx_sesiones_usuario (id_usuario),
    INDEX idx_sesiones_token (token(50)),
    INDEX idx_sesiones_activa (activa),
    CONSTRAINT fk_sesiones_usuario
        FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Gestión de sesiones JWT para web y app móvil';


-- ═══════════════════════════════════════════════════════════════════════════
--  DOMINIO 2: NEGOCIOS, SUCURSALES Y EQUIPO
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE negocios (
    id_negocio           INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    id_usuario_propietario INT UNSIGNED  NOT NULL,
    nombre               VARCHAR(150)   NOT NULL,
    tipo                 ENUM('veterinaria','tienda_mascotas','peluqueria_canina',
                              'guarderia','entrenador','clinica','multiservicio') NOT NULL,
    descripcion          TEXT           NULL,
    -- Contacto
    telefono             VARCHAR(20)    NULL,
    whatsapp             VARCHAR(20)    NULL,
    email                VARCHAR(150)   NULL,
    sitio_web            VARCHAR(300)   NULL,
    -- Identificación legal
    nit                  VARCHAR(20)    NULL,
    razon_social         VARCHAR(200)   NULL,
    -- Ubicación
    direccion            VARCHAR(300)   NULL,
    ciudad               VARCHAR(100)   NOT NULL DEFAULT 'Sincelejo',
    departamento         VARCHAR(100)   NOT NULL DEFAULT 'Sucre',
    pais                 VARCHAR(60)    NOT NULL DEFAULT 'Colombia',
    codigo_postal        VARCHAR(10)    NULL,
    latitud              DECIMAL(10,8)  NULL,
    longitud             DECIMAL(11,8)  NULL,
    -- Media
    logo_url             VARCHAR(500)   NULL,
    banner_url           VARCHAR(500)   NULL,
    -- Métricas (se actualizan via trigger)
    calificacion_promedio DECIMAL(3,2)  NOT NULL DEFAULT 0.00,
    total_resenas        INT UNSIGNED   NOT NULL DEFAULT 0,
    total_citas          INT UNSIGNED   NOT NULL DEFAULT 0,
    -- Estado y visibilidad
    verificado           BOOLEAN        NOT NULL DEFAULT FALSE,
    destacado            BOOLEAN        NOT NULL DEFAULT FALSE,
    activo               BOOLEAN        NOT NULL DEFAULT TRUE,
    fecha_registro       DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion  DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id_negocio),
    INDEX idx_negocios_tipo (tipo),
    INDEX idx_negocios_ciudad (ciudad),
    INDEX idx_negocios_activo (activo),
    INDEX idx_negocios_destacado (destacado),
    INDEX idx_negocios_geo (latitud, longitud),
    INDEX idx_negocios_propietario (id_usuario_propietario),
    CONSTRAINT fk_negocios_propietario
        FOREIGN KEY (id_usuario_propietario) REFERENCES usuarios (id_usuario)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Negocios del sector de mascotas registrados en la plataforma';


CREATE TABLE sucursales (
    id_sucursal      INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    id_negocio       INT UNSIGNED    NOT NULL,
    nombre           VARCHAR(150)    NOT NULL,
    descripcion      VARCHAR(300)    NULL,
    telefono         VARCHAR(20)     NULL,
    direccion        VARCHAR(300)    NOT NULL,
    ciudad           VARCHAR(100)    NOT NULL DEFAULT 'Sincelejo',
    latitud          DECIMAL(10,8)   NULL,
    longitud         DECIMAL(11,8)   NULL,
    es_principal     BOOLEAN         NOT NULL DEFAULT FALSE,
    activo           BOOLEAN         NOT NULL DEFAULT TRUE,
    fecha_registro   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id_sucursal),
    INDEX idx_sucursales_negocio (id_negocio),
    INDEX idx_sucursales_geo (latitud, longitud),
    INDEX idx_sucursales_activo (activo),
    CONSTRAINT fk_sucursales_negocio
        FOREIGN KEY (id_negocio) REFERENCES negocios (id_negocio)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Sucursales o sedes de cada negocio';


CREATE TABLE horarios_negocio (
    id_horario       INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    id_sucursal      INT UNSIGNED    NOT NULL,
    dia_semana       TINYINT UNSIGNED NOT NULL COMMENT '0=Domingo, 1=Lunes, ..., 6=Sábado',
    hora_apertura    TIME            NOT NULL,
    hora_cierre      TIME            NOT NULL,
    activo           BOOLEAN         NOT NULL DEFAULT TRUE,
    PRIMARY KEY (id_horario),
    INDEX idx_horarios_sucursal (id_sucursal),
    -- Varios rangos por día (horario partido): sin UNIQUE por día. Migración 002.
    INDEX idx_horarios_sucursal_dia (id_sucursal, dia_semana),
    CONSTRAINT fk_horarios_sucursal
        FOREIGN KEY (id_sucursal) REFERENCES sucursales (id_sucursal)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Horarios de atención por sucursal: uno o varios rangos por día';


CREATE TABLE roles (
    id_rol           INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    -- NULL = rol global del sistema
    -- NOT NULL = rol personalizado de un negocio
    id_negocio       INT UNSIGNED    NULL,
    nombre           VARCHAR(60)     NOT NULL,
    descripcion      VARCHAR(200)    NULL,
    permisos_json    JSON            NOT NULL COMMENT 'Objeto JSON con permisos granulares por módulo',
    es_sistema       BOOLEAN         NOT NULL DEFAULT FALSE COMMENT 'TRUE = rol predefinido/global no editable',
    fecha_creacion   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id_rol),
    -- Permite mismo nombre en distintos negocios
    -- pero evita duplicados dentro del mismo negocio
    UNIQUE KEY uq_roles_negocio_nombre (
        id_negocio,
        nombre
    ),
    INDEX idx_roles_negocio (id_negocio),
    CONSTRAINT fk_roles_negocio
        FOREIGN KEY (id_negocio)
        REFERENCES negocios (id_negocio)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci
COMMENT='Roles globales del sistema y roles personalizados por negocio';


CREATE TABLE empleados (
    id_empleado      INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    id_negocio       INT UNSIGNED    NOT NULL,
    id_rol           INT UNSIGNED    NOT NULL,
    id_usuario       INT UNSIGNED    NULL COMMENT 'Si el empleado también tiene cuenta de usuario',
    nombre           VARCHAR(80)     NOT NULL,
    apellido         VARCHAR(80)     NOT NULL,
    email            VARCHAR(150)    NULL,
    telefono         VARCHAR(20)     NULL,
    documento        VARCHAR(30)     NULL COMMENT 'Cédula, CE, pasaporte',
    especialidad     VARCHAR(150)    NULL,
    titulo_profesional VARCHAR(150)  NULL,
    registro_profesional VARCHAR(60) NULL,
    foto_url         VARCHAR(500)    NULL,
    notas            TEXT            NULL,
    activo           BOOLEAN         NOT NULL DEFAULT TRUE,
    fecha_vinculacion DATE           NOT NULL,
    fecha_retiro     DATE            NULL,
    fecha_creacion   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id_empleado),
    INDEX idx_empleados_negocio (id_negocio),
    INDEX idx_empleados_rol (id_rol),
    INDEX idx_empleados_usuario (id_usuario),
    INDEX idx_empleados_activo (activo),
    CONSTRAINT fk_empleados_negocio
        FOREIGN KEY (id_negocio) REFERENCES negocios (id_negocio)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_empleados_rol
        FOREIGN KEY (id_rol) REFERENCES roles (id_rol)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_empleados_usuario
        FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Empleados y veterinarios de cada negocio';


-- Nueva tabla para el manejo de invitaciones,

CREATE TABLE invitaciones_empleado (
    id_invitacion    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    id_empleado      INT UNSIGNED NOT NULL,
    id_negocio       INT UNSIGNED NOT NULL,
    email            VARCHAR(150) NOT NULL,
    token            VARCHAR(255) NOT NULL,
    expiracion       DATETIME NOT NULL,
    usado            BOOLEAN DEFAULT FALSE,
    intentos_reenvio TINYINT DEFAULT 0,
    fecha_creacion   DATETIME DEFAULT CURRENT_TIMESTAMP,
    fecha_usado      DATETIME NULL,

    UNIQUE KEY uq_token (token),
    INDEX idx_inv_empleado (id_empleado),
    INDEX idx_inv_email (email),

    CONSTRAINT fk_inv_empleado
        FOREIGN KEY (id_empleado) REFERENCES empleados(id_empleado)
        ON DELETE CASCADE,

    CONSTRAINT fk_inv_negocio
        FOREIGN KEY (id_negocio) REFERENCES negocios(id_negocio)
        ON DELETE CASCADE
);


-- ═══════════════════════════════════════════════════════════════════════════
--  DOMINIO 3: PLANES Y SUSCRIPCIONES
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE planes_suscripcion (
    id_plan                  INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    nombre                   VARCHAR(60)     NOT NULL,
    descripcion              VARCHAR(300)    NULL,
    precio_mensual           DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
    precio_anual             DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
    -- Límites funcionales
    max_sucursales           INT             NOT NULL DEFAULT 1,
    max_citas_mes            INT             NOT NULL DEFAULT 30 COMMENT '-1 = ilimitado',
    max_empleados            INT             NOT NULL DEFAULT 3 COMMENT '-1 = ilimitado',
    max_productos            INT             NOT NULL DEFAULT 50 COMMENT '-1 = ilimitado',
    -- Features booleanos
    estadisticas_avanzadas   BOOLEAN         NOT NULL DEFAULT FALSE,
    soporte_prioritario      BOOLEAN         NOT NULL DEFAULT FALSE,
    integracion_whatsapp     BOOLEAN         NOT NULL DEFAULT FALSE,
    exportar_informes        BOOLEAN         NOT NULL DEFAULT FALSE,
    ia_recomendaciones       BOOLEAN         NOT NULL DEFAULT FALSE,
    api_personalizada        BOOLEAN         NOT NULL DEFAULT FALSE,
    dominio_personalizado    BOOLEAN         NOT NULL DEFAULT FALSE,
    gestor_dedicado          BOOLEAN         NOT NULL DEFAULT FALSE,
    sla_garantizado          BOOLEAN         NOT NULL DEFAULT FALSE,
    capacitacion_incluida    BOOLEAN         NOT NULL DEFAULT FALSE,
    -- Estado
    activo                   BOOLEAN         NOT NULL DEFAULT TRUE,
    orden_display            TINYINT         NOT NULL DEFAULT 0,
    PRIMARY KEY (id_plan),
    UNIQUE KEY uq_planes_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Planes de suscripción disponibles: Gratuito, Pro, Enterprise';


CREATE TABLE suscripciones (
    id_suscripcion   INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    id_negocio       INT UNSIGNED    NOT NULL,
    id_plan          INT UNSIGNED    NOT NULL,
    tipo_facturacion ENUM('mensual','anual') NOT NULL DEFAULT 'mensual',
    estado           ENUM('activa','vencida','cancelada','en_prueba','pendiente') NOT NULL DEFAULT 'activa',
    fecha_inicio     DATE            NOT NULL,
    fecha_fin        DATE            NOT NULL,
    fecha_prueba_fin DATE            NULL COMMENT 'Fin del período de prueba gratuito',
    auto_renovar     BOOLEAN         NOT NULL DEFAULT TRUE,
    monto_pagado     DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
    descuento_pct    DECIMAL(5,2)    NOT NULL DEFAULT 0.00,
    notas            VARCHAR(300)    NULL,
    fecha_creacion   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id_suscripcion),
    INDEX idx_suscripciones_negocio (id_negocio),
    INDEX idx_suscripciones_plan (id_plan),
    INDEX idx_suscripciones_estado (estado),
    INDEX idx_suscripciones_fecha_fin (fecha_fin),
    CONSTRAINT fk_suscripciones_negocio
        FOREIGN KEY (id_negocio) REFERENCES negocios (id_negocio)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_suscripciones_plan
        FOREIGN KEY (id_plan) REFERENCES planes_suscripcion (id_plan)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Suscripciones activas de negocios a los planes de PetCat';


CREATE TABLE integraciones (
    id_integracion   INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    id_negocio       INT UNSIGNED    NOT NULL,
    tipo             ENUM('mercadopago','payu','whatsapp_api','google_maps',
                          'firebase','twilio','stripe') NOT NULL,
    credenciales_json JSON           NULL COMMENT 'Tokens y llaves (encriptado en capa de app)',
    configuracion_json JSON          NULL COMMENT 'Configuración adicional del servicio',
    activo           BOOLEAN         NOT NULL DEFAULT FALSE,
    ultimo_test      DATETIME        NULL,
    estado_ultimo_test ENUM('ok','error','pendiente') NULL,
    fecha_conexion   DATETIME        NULL,
    fecha_actualizacion DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id_integracion),
    UNIQUE KEY uq_integraciones_negocio_tipo (id_negocio, tipo),
    INDEX idx_integraciones_negocio (id_negocio),
    CONSTRAINT fk_integraciones_negocio
        FOREIGN KEY (id_negocio) REFERENCES negocios (id_negocio)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Integraciones con pasarelas de pago, WhatsApp, Google Maps, etc.';


-- ═══════════════════════════════════════════════════════════════════════════
--  DOMINIO 4: MASCOTAS Y SALUD
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE mascotas (
    id_mascota       INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    id_usuario       INT UNSIGNED    NOT NULL,
    nombre           VARCHAR(80)     NOT NULL,
    especie          ENUM('perro','gato','conejo','ave','reptil','roedor','pez','otro') NOT NULL,
    raza             VARCHAR(100)    NULL,
    color            VARCHAR(100)    NULL,
    fecha_nacimiento DATE            NULL,
    sexo             ENUM('macho','hembra','desconocido') NOT NULL DEFAULT 'desconocido',
    peso             DECIMAL(6,2)    NULL COMMENT 'En kilogramos',
    -- Identificación
    microchip        VARCHAR(50)     NULL,
    numero_registro  VARCHAR(60)     NULL,
    -- Salud general
    esterilizado     BOOLEAN         NOT NULL DEFAULT FALSE,
    tiene_alergias   BOOLEAN         NOT NULL DEFAULT FALSE,
    alergias_detalle TEXT            NULL,
    condiciones_medicas TEXT         NULL,
    tipo_sangre      VARCHAR(10)     NULL,
    -- Media
    foto_url         VARCHAR(500)    NULL,
    -- Estado
    activo           BOOLEAN         NOT NULL DEFAULT TRUE,
    fallecido        BOOLEAN         NOT NULL DEFAULT FALSE,
    fecha_fallecimiento DATE         NULL,
    fecha_registro   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id_mascota),
    INDEX idx_mascotas_usuario (id_usuario),
    INDEX idx_mascotas_especie (especie),
    INDEX idx_mascotas_microchip (microchip),
    INDEX idx_mascotas_activo (activo),
    CONSTRAINT fk_mascotas_usuario
        FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Mascotas registradas por los usuarios en la plataforma';


CREATE TABLE historial_medico (
    id_historial     BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    id_mascota       INT UNSIGNED    NOT NULL,
    id_cita          INT UNSIGNED    NULL,
    id_empleado      INT UNSIGNED    NULL,
    id_negocio       INT UNSIGNED    NULL,
    -- Datos del registro
    tipo             ENUM('consulta_general','cirugia','vacunacion','examen_laboratorio',
                          'radiografia','ecografia','hospitalizacion','urgencia',
                          'desparasitacion','otro') NOT NULL,
    motivo_consulta  TEXT            NULL,
    diagnostico      TEXT            NULL,
    tratamiento      TEXT            NULL,
    medicamentos_prescritos TEXT     NULL,
    indicaciones     TEXT            NULL,
    proximo_control  DATE            NULL,
    -- Signos vitales
    peso_registro    DECIMAL(6,2)    NULL,
    temperatura      DECIMAL(4,1)    NULL COMMENT 'En °C',
    frecuencia_cardiaca SMALLINT     NULL COMMENT 'Latidos por minuto',
    frecuencia_respiratoria SMALLINT NULL COMMENT 'Respiraciones por minuto',
    -- Archivos
    archivos_json    JSON            NULL COMMENT 'URLs de imágenes, PDF, radiografías',
    notas_internas   TEXT            NULL,
    fecha            DATE            NOT NULL,
    fecha_creacion   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id_historial),
    INDEX idx_historial_mascota (id_mascota),
    INDEX idx_historial_cita (id_cita),
    INDEX idx_historial_empleado (id_empleado),
    INDEX idx_historial_fecha (fecha),
    INDEX idx_historial_tipo (tipo),
    CONSTRAINT fk_historial_mascota
        FOREIGN KEY (id_mascota) REFERENCES mascotas (id_mascota)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_historial_empleado
        FOREIGN KEY (id_empleado) REFERENCES empleados (id_empleado)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_historial_negocio
        FOREIGN KEY (id_negocio) REFERENCES negocios (id_negocio)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Historial médico completo de cada mascota';


CREATE TABLE vacunas (
    id_vacuna        INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    id_mascota       INT UNSIGNED    NOT NULL,
    id_historial_medico BIGINT UNSIGNED NULL,
    id_empleado      INT UNSIGNED    NULL,
    id_negocio       INT UNSIGNED    NULL,
    nombre_vacuna    VARCHAR(150)    NOT NULL,
    enfermedad_objetivo VARCHAR(150) NULL,
    laboratorio      VARCHAR(100)    NULL,
    lote             VARCHAR(60)     NULL,
    dosis            VARCHAR(60)     NULL COMMENT 'Ej: 1a dosis, 2a dosis, refuerzo anual',
    via_administracion VARCHAR(60)   NULL,
    sitio_aplicacion VARCHAR(60)     NULL,
    fecha_aplicacion DATE            NOT NULL,
    fecha_proxima    DATE            NULL,
    estado           ENUM('al_dia','proximo','vencido','no_aplica') NOT NULL DEFAULT 'al_dia',
    comprobante_url  VARCHAR(500)    NULL COMMENT 'Foto del carnet de vacunación',
    notas            VARCHAR(300)    NULL,
    fecha_creacion   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id_vacuna),
    INDEX idx_vacunas_mascota (id_mascota),
    INDEX idx_vacunas_fecha_proxima (fecha_proxima),
    INDEX idx_vacunas_estado (estado),
    INDEX idx_vacunas_empleado (id_empleado),
    CONSTRAINT fk_vacunas_mascota
        FOREIGN KEY (id_mascota) REFERENCES mascotas (id_mascota)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_vacunas_historial
        FOREIGN KEY (id_historial_medico) REFERENCES historial_medico (id_historial)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_vacunas_empleado
        FOREIGN KEY (id_empleado) REFERENCES empleados (id_empleado)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_vacunas_negocio
        FOREIGN KEY (id_negocio) REFERENCES negocios (id_negocio)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Registro de vacunas con trazabilidad de lote y laboratorio';


-- ═══════════════════════════════════════════════════════════════════════════
--  DOMINIO 5: SERVICIOS Y CITAS
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE categorias_servicio (
    id_categoria     INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    nombre           VARCHAR(100)    NOT NULL,
    descripcion      VARCHAR(300)    NULL,
    icono            VARCHAR(100)    NULL,
    orden_display    TINYINT         NOT NULL DEFAULT 0,
    activo           BOOLEAN         NOT NULL DEFAULT TRUE,
    PRIMARY KEY (id_categoria),
    UNIQUE KEY uq_cat_servicio_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Categorías de servicios: consultas, baño, vacunas, cirugía, etc.';


CREATE TABLE servicios (
    id_servicio      INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    id_negocio       INT UNSIGNED    NOT NULL,
    id_categoria     INT UNSIGNED    NOT NULL,
    nombre           VARCHAR(150)    NOT NULL,
    descripcion      TEXT            NULL,
    precio_base      DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
    precio_maximo    DECIMAL(12,2)   NULL COMMENT 'Para precios variables',
    tipo_precio      ENUM('fijo','por_hora','por_dia','variable') NOT NULL DEFAULT 'fijo',
    duracion_minutos SMALLINT UNSIGNED NOT NULL DEFAULT 30,
    -- Restricciones
    tipo_mascota     SET('perro','gato','conejo','ave','reptil','roedor','todos')
                     NOT NULL DEFAULT 'todos',
    peso_min_kg      DECIMAL(6,2)    NULL,
    peso_max_kg      DECIMAL(6,2)    NULL,
    -- Disponibilidad
    requiere_cita    BOOLEAN         NOT NULL DEFAULT TRUE,
    max_citas_dia    TINYINT UNSIGNED NULL COMMENT 'NULL = sin límite',
    dias_disponible  SET('lunes','martes','miercoles','jueves','viernes','sabado','domingo')
                     NULL COMMENT 'NULL = todos los días',
    -- Visibilidad e innovación
    visible_app      BOOLEAN         NOT NULL DEFAULT TRUE,
    en_oferta        BOOLEAN         NOT NULL DEFAULT FALSE,
    precio_oferta    DECIMAL(12,2)   NULL,
    fecha_inicio_oferta DATE         NULL,
    fecha_fin_oferta DATE            NULL,
    etiquetas_json   JSON            NULL COMMENT 'Tags para búsqueda y IA: ["urgencia","premium","spa"]',
    activo           BOOLEAN         NOT NULL DEFAULT TRUE,
    fecha_creacion   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id_servicio),
    INDEX idx_servicios_negocio (id_negocio),
    INDEX idx_servicios_categoria (id_categoria),
    INDEX idx_servicios_activo (activo),
    INDEX idx_servicios_visible (visible_app),
    INDEX idx_servicios_oferta (en_oferta),
    FULLTEXT INDEX ft_servicios_busqueda (nombre, descripcion),
    CONSTRAINT fk_servicios_negocio
        FOREIGN KEY (id_negocio) REFERENCES negocios (id_negocio)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_servicios_categoria
        FOREIGN KEY (id_categoria) REFERENCES categorias_servicio (id_categoria)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Servicios que ofrecen los negocios (baño, consulta, cirugía, etc.)';


CREATE TABLE citas (
    id_cita          INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    id_negocio       INT UNSIGNED    NOT NULL,
    id_sucursal      INT UNSIGNED    NULL,
    id_usuario       INT UNSIGNED    NOT NULL,
    id_mascota       INT UNSIGNED    NOT NULL,
    id_servicio      INT UNSIGNED    NOT NULL,
    id_empleado      INT UNSIGNED    NULL,
    -- Tiempo
    fecha            DATE            NOT NULL,
    hora_inicio      TIME            NOT NULL,
    hora_fin         TIME            NOT NULL,
    -- Estado y resultado
    estado           ENUM('pendiente','confirmada','en_curso','completada',
                          'cancelada','no_asistio','reprogramada') NOT NULL DEFAULT 'pendiente',
    -- Económico
    precio_estimado  DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
    precio_final     DECIMAL(12,2)   NULL,
    descuento_pct    DECIMAL(5,2)    NOT NULL DEFAULT 0.00,
    descuento_monto  DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
    -- Contexto clínico
    notas_cliente    TEXT            NULL COMMENT 'Instrucciones o notas del dueño',
    notas_internas   TEXT            NULL COMMENT 'Notas del veterinario (privadas)',
    motivo_cancelacion TEXT          NULL,
    prioridad        ENUM('normal','alta','urgente') NOT NULL DEFAULT 'normal',
    -- Comunicación
    recordatorio_enviado BOOLEAN     NOT NULL DEFAULT FALSE,
    confirmacion_enviada BOOLEAN     NOT NULL DEFAULT FALSE,
    -- Metadatos
    origen           ENUM('app_movil','panel_web','whatsapp','presencial','telefono')
                     NOT NULL DEFAULT 'app_movil',
    id_cita_origen   INT UNSIGNED    NULL COMMENT 'Si es reprogramación de otra cita',
    fecha_creacion   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id_cita),
    INDEX idx_citas_negocio (id_negocio),
    INDEX idx_citas_usuario (id_usuario),
    INDEX idx_citas_mascota (id_mascota),
    INDEX idx_citas_empleado (id_empleado),
    INDEX idx_citas_fecha (fecha),
    INDEX idx_citas_estado (estado),
    INDEX idx_citas_negocio_fecha (id_negocio, fecha),
    INDEX idx_citas_empleado_fecha (id_empleado, fecha),
    CONSTRAINT fk_citas_negocio
        FOREIGN KEY (id_negocio) REFERENCES negocios (id_negocio)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_citas_sucursal
        FOREIGN KEY (id_sucursal) REFERENCES sucursales (id_sucursal)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_citas_usuario
        FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_citas_mascota
        FOREIGN KEY (id_mascota) REFERENCES mascotas (id_mascota)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_citas_servicio
        FOREIGN KEY (id_servicio) REFERENCES servicios (id_servicio)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_citas_empleado
        FOREIGN KEY (id_empleado) REFERENCES empleados (id_empleado)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_citas_origen
        FOREIGN KEY (id_cita_origen) REFERENCES citas (id_cita)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Tabla central de citas agendadas en la plataforma';


CREATE TABLE historial_citas (
    id_historial     BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    id_cita          INT UNSIGNED    NOT NULL,
    id_empleado      INT UNSIGNED    NULL,
    id_usuario       INT UNSIGNED    NULL COMMENT 'Si el cambio lo hizo el cliente',
    campo_modificado VARCHAR(80)     NOT NULL,
    valor_anterior   TEXT            NULL,
    valor_nuevo      TEXT            NULL,
    motivo           VARCHAR(300)    NULL,
    ip_address       VARCHAR(45)     NULL,
    fecha_cambio     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id_historial),
    INDEX idx_hcitas_cita (id_cita),
    INDEX idx_hcitas_empleado (id_empleado),
    INDEX idx_hcitas_fecha (fecha_cambio),
    CONSTRAINT fk_hcitas_cita
        FOREIGN KEY (id_cita) REFERENCES citas (id_cita)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_hcitas_empleado
        FOREIGN KEY (id_empleado) REFERENCES empleados (id_empleado)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Auditoría de todos los cambios realizados sobre una cita';


CREATE TABLE disponibilidad_empleado (
    id_disponibilidad INT UNSIGNED   NOT NULL AUTO_INCREMENT,
    id_empleado      INT UNSIGNED    NOT NULL,
    id_sucursal      INT UNSIGNED    NULL,
    tipo             ENUM('horario_normal','bloqueo','vacacion','evento_especial') NOT NULL,
    dia_semana       TINYINT UNSIGNED NULL COMMENT '0=Dom, 1=Lun..., para horarios normales',
    fecha_especifica DATE            NULL COMMENT 'Para bloqueos puntuales',
    hora_inicio      TIME            NULL,
    hora_fin         TIME            NULL,
    motivo           VARCHAR(200)    NULL,
    recurrente       BOOLEAN         NOT NULL DEFAULT FALSE,
    activo           BOOLEAN         NOT NULL DEFAULT TRUE,
    PRIMARY KEY (id_disponibilidad),
    INDEX idx_disponibilidad_empleado (id_empleado),
    INDEX idx_disponibilidad_fecha (fecha_especifica),
    CONSTRAINT fk_disponibilidad_empleado
        FOREIGN KEY (id_empleado) REFERENCES empleados (id_empleado)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Disponibilidad horaria de cada empleado para el agendamiento automático';


-- ═══════════════════════════════════════════════════════════════════════════
--  DOMINIO 6: INVENTARIO
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE categorias_producto (
    id_categoria     INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    nombre           VARCHAR(100)    NOT NULL,
    descripcion      VARCHAR(300)    NULL,
    categoria_padre  INT UNSIGNED    NULL COMMENT 'Para subcategorías',
    orden_display    TINYINT         NOT NULL DEFAULT 0,
    activo           BOOLEAN         NOT NULL DEFAULT TRUE,
    PRIMARY KEY (id_categoria),
    UNIQUE KEY uq_catprod_nombre (nombre),
    INDEX idx_catprod_padre (categoria_padre),
    CONSTRAINT fk_catprod_padre
        FOREIGN KEY (categoria_padre) REFERENCES categorias_producto (id_categoria)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Categorías de productos del inventario (medicamentos, alimentos, accesorios)';


CREATE TABLE productos (
    id_producto      INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    id_negocio       INT UNSIGNED    NOT NULL,
    id_categoria     INT UNSIGNED    NOT NULL,
    nombre           VARCHAR(200)    NOT NULL,
    descripcion      TEXT            NULL,
    marca            VARCHAR(100)    NULL,
    codigo_sku       VARCHAR(80)     NULL,
    codigo_barras    VARCHAR(50)     NULL,
    -- Unidades
    unidad_medida    VARCHAR(30)     NOT NULL DEFAULT 'und',
    presentacion     VARCHAR(100)    NULL COMMENT 'Ej: Caja x 10, Frasco 100ml',
    -- Precios
    precio_compra    DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
    precio_venta     DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
    precio_oferta    DECIMAL(12,2)   NULL,
    iva_pct          DECIMAL(5,2)    NOT NULL DEFAULT 0.00,
    -- Stock
    stock_actual     INT             NOT NULL DEFAULT 0,
    stock_minimo     INT             NOT NULL DEFAULT 0,
    stock_maximo     INT             NULL,
    -- Fechas
    fecha_vencimiento DATE           NULL,
    fecha_ingreso    DATE            NULL,
    -- Restricciones y visibilidad
    requiere_prescripcion BOOLEAN    NOT NULL DEFAULT FALSE,
    venta_en_app     BOOLEAN         NOT NULL DEFAULT TRUE,
    especie_objetivo SET('perro','gato','conejo','ave','reptil','roedor','todos')
                     NOT NULL DEFAULT 'todos',
    imagen_url       VARCHAR(500)    NULL,
    etiquetas_json   JSON            NULL,
    activo           BOOLEAN         NOT NULL DEFAULT TRUE,
    fecha_creacion   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id_producto),
    INDEX idx_productos_negocio (id_negocio),
    INDEX idx_productos_categoria (id_categoria),
    INDEX idx_productos_sku (codigo_sku),
    INDEX idx_productos_barras (codigo_barras),
    INDEX idx_productos_stock (stock_actual),
    INDEX idx_productos_vencimiento (fecha_vencimiento),
    INDEX idx_productos_activo (activo),
    FULLTEXT INDEX ft_productos_busqueda (nombre, descripcion, marca),
    CONSTRAINT fk_productos_negocio
        FOREIGN KEY (id_negocio) REFERENCES negocios (id_negocio)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_productos_categoria
        FOREIGN KEY (id_categoria) REFERENCES categorias_producto (id_categoria)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Productos del inventario: medicamentos, alimentos, accesorios, insumos';


CREATE TABLE movimientos_inventario (
    id_movimiento    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    id_producto      INT UNSIGNED    NOT NULL,
    id_cita          INT UNSIGNED    NULL COMMENT 'Si el movimiento fue por uso en una cita',
    id_empleado      INT UNSIGNED    NULL,
    id_compra        INT UNSIGNED    NULL COMMENT 'Si fue venta en la app',
    tipo             ENUM('entrada','salida','ajuste','devolucion','merma','transferencia')
                     NOT NULL,
    cantidad         INT             NOT NULL,
    cantidad_anterior INT            NOT NULL,
    cantidad_nueva   INT             NOT NULL,
    precio_unitario  DECIMAL(12,2)   NULL,
    motivo           VARCHAR(300)    NULL,
    referencia_externa VARCHAR(100)  NULL COMMENT 'Número de factura, orden de compra, etc.',
    fecha            DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id_movimiento),
    INDEX idx_movinv_producto (id_producto),
    INDEX idx_movinv_cita (id_cita),
    INDEX idx_movinv_empleado (id_empleado),
    INDEX idx_movinv_tipo (tipo),
    INDEX idx_movinv_fecha (fecha),
    CONSTRAINT fk_movinv_producto
        FOREIGN KEY (id_producto) REFERENCES productos (id_producto)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_movinv_cita
        FOREIGN KEY (id_cita) REFERENCES citas (id_cita)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_movinv_empleado
        FOREIGN KEY (id_empleado) REFERENCES empleados (id_empleado)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Trazabilidad de todas las entradas y salidas del inventario';


-- ═══════════════════════════════════════════════════════════════════════════
--  DOMINIO 7: PAGOS Y COMPRAS
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE compras (
    id_compra        INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    id_usuario       INT UNSIGNED    NOT NULL,
    id_negocio       INT UNSIGNED    NOT NULL,
    subtotal         DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
    iva_total        DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
    descuento_total  DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
    total            DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
    estado           ENUM('pendiente','confirmada','enviada','entregada',
                          'cancelada','devuelta') NOT NULL DEFAULT 'pendiente',
    direccion_entrega TEXT           NULL,
    notas            TEXT            NULL,
    fecha            DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id_compra),
    INDEX idx_compras_usuario (id_usuario),
    INDEX idx_compras_negocio (id_negocio),
    INDEX idx_compras_estado (estado),
    INDEX idx_compras_fecha (fecha),
    CONSTRAINT fk_compras_usuario
        FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_compras_negocio
        FOREIGN KEY (id_negocio) REFERENCES negocios (id_negocio)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Órdenes de compra de productos a través de la app móvil';


CREATE TABLE detalle_compra (
    id_detalle       INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    id_compra        INT UNSIGNED    NOT NULL,
    id_producto      INT UNSIGNED    NOT NULL,
    cantidad         INT UNSIGNED    NOT NULL,
    precio_unitario  DECIMAL(12,2)   NOT NULL,
    iva_pct          DECIMAL(5,2)    NOT NULL DEFAULT 0.00,
    descuento_pct    DECIMAL(5,2)    NOT NULL DEFAULT 0.00,
    subtotal         DECIMAL(12,2)   NOT NULL,
    PRIMARY KEY (id_detalle),
    INDEX idx_detalle_compra (id_compra),
    INDEX idx_detalle_producto (id_producto),
    CONSTRAINT fk_detalle_compra
        FOREIGN KEY (id_compra) REFERENCES compras (id_compra)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_detalle_producto
        FOREIGN KEY (id_producto) REFERENCES productos (id_producto)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Detalle de productos de cada compra';


CREATE TABLE pagos (
    id_pago          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    id_usuario       INT UNSIGNED    NOT NULL,
    id_negocio       INT UNSIGNED    NULL,
    -- Origen del pago (solo uno activo a la vez)
    id_cita          INT UNSIGNED    NULL,
    id_suscripcion   INT UNSIGNED    NULL,
    id_compra        INT UNSIGNED    NULL,
    -- Monto
    monto            DECIMAL(12,2)   NOT NULL,
    moneda           CHAR(3)         NOT NULL DEFAULT 'COP',
    -- Pasarela
    metodo_pago      ENUM('mercadopago','payu','pse','tarjeta_credito',
                          'tarjeta_debito','efectivo','transferencia','otro') NOT NULL,
    pasarela         VARCHAR(60)     NULL,
    referencia_externa VARCHAR(200)  NULL COMMENT 'ID de transacción en la pasarela',
    codigo_autorizacion VARCHAR(100) NULL,
    -- Estado
    estado           ENUM('pendiente','procesando','aprobado','rechazado',
                          'reembolsado','cancelado') NOT NULL DEFAULT 'pendiente',
    intento_numero   TINYINT         NOT NULL DEFAULT 1,
    respuesta_json   JSON            NULL COMMENT 'Respuesta completa de la pasarela',
    -- Facturación
    factura_url      VARCHAR(500)    NULL,
    fecha_pago       DATETIME        NULL,
    fecha_creacion   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id_pago),
    INDEX idx_pagos_usuario (id_usuario),
    INDEX idx_pagos_negocio (id_negocio),
    INDEX idx_pagos_cita (id_cita),
    INDEX idx_pagos_estado (estado),
    INDEX idx_pagos_referencia (referencia_externa),
    INDEX idx_pagos_fecha (fecha_creacion),
    CONSTRAINT fk_pagos_usuario
        FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_pagos_cita
        FOREIGN KEY (id_cita) REFERENCES citas (id_cita)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_pagos_suscripcion
        FOREIGN KEY (id_suscripcion) REFERENCES suscripciones (id_suscripcion)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_pagos_compra
        FOREIGN KEY (id_compra) REFERENCES compras (id_compra)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Registro unificado de todos los pagos: citas, suscripciones y compras';


-- ═══════════════════════════════════════════════════════════════════════════
--  DOMINIO 8: COMUNICACIÓN, NOTIFICACIONES E IA
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE recordatorios (
    id_recordatorio  INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    id_usuario       INT UNSIGNED    NOT NULL,
    id_mascota       INT UNSIGNED    NULL,
    id_cita          INT UNSIGNED    NULL,
    id_vacuna        INT UNSIGNED    NULL,
    tipo             ENUM('cita_confirmacion','cita_recordatorio','vacuna_proxima',
                          'vacuna_vencida','control_medico','alimentacion',
                          'desparasitacion','bano','medicamento','personalizado') NOT NULL,
    titulo           VARCHAR(200)    NOT NULL,
    mensaje          TEXT            NOT NULL,
    canal            SET('push','whatsapp','email','sms') NOT NULL DEFAULT 'push',
    estado           ENUM('pendiente','enviado','fallido','cancelado') NOT NULL DEFAULT 'pendiente',
    fecha_programada DATETIME        NOT NULL,
    fecha_envio      DATETIME        NULL,
    intentos         TINYINT         NOT NULL DEFAULT 0,
    error_detalle    VARCHAR(500)    NULL,
    recurrente       BOOLEAN         NOT NULL DEFAULT FALSE,
    frecuencia_dias  SMALLINT        NULL COMMENT 'Cada N días si es recurrente',
    fecha_creacion   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id_recordatorio),
    INDEX idx_recordatorios_usuario (id_usuario),
    INDEX idx_recordatorios_mascota (id_mascota),
    INDEX idx_recordatorios_estado (estado),
    INDEX idx_recordatorios_fecha (fecha_programada),
    INDEX idx_recordatorios_tipo (tipo),
    CONSTRAINT fk_recordatorios_usuario
        FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_recordatorios_mascota
        FOREIGN KEY (id_mascota) REFERENCES mascotas (id_mascota)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_recordatorios_cita
        FOREIGN KEY (id_cita) REFERENCES citas (id_cita)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_recordatorios_vacuna
        FOREIGN KEY (id_vacuna) REFERENCES vacunas (id_vacuna)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Recordatorios automáticos: citas, vacunas, medicamentos y controles';


CREATE TABLE notificaciones (
    id_notificacion  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    id_usuario       INT UNSIGNED    NOT NULL,
    id_negocio       INT UNSIGNED    NULL,
    tipo             VARCHAR(60)     NOT NULL COMMENT 'Ej: nueva_cita, pago_aprobado, stock_bajo',
    titulo           VARCHAR(200)    NOT NULL,
    mensaje          TEXT            NOT NULL,
    datos_extra_json JSON            NULL COMMENT 'Datos adicionales para deep link en la app',
    canal            ENUM('push','whatsapp','email','in_app','sms') NOT NULL DEFAULT 'in_app',
    estado           ENUM('enviada','leida','archivada') NOT NULL DEFAULT 'enviada',
    leida_en         DATETIME        NULL,
    fecha_creacion   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id_notificacion),
    INDEX idx_notif_usuario (id_usuario),
    INDEX idx_notif_negocio (id_negocio),
    INDEX idx_notif_estado (estado),
    INDEX idx_notif_tipo (tipo),
    INDEX idx_notif_fecha (fecha_creacion),
    CONSTRAINT fk_notif_usuario
        FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_notif_negocio
        FOREIGN KEY (id_negocio) REFERENCES negocios (id_negocio)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Notificaciones en tiempo real enviadas a usuarios y negocios';


CREATE TABLE recomendaciones_ia (
    id_recomendacion BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    id_usuario       INT UNSIGNED    NULL,
    id_mascota       INT UNSIGNED    NULL,
    id_negocio       INT UNSIGNED    NULL,
    id_servicio      INT UNSIGNED    NULL,
    id_producto      INT UNSIGNED    NULL,
    -- Clasificación
    tipo             ENUM('servicio_sugerido','producto_sugerido','veterinaria_cercana',
                          'vacuna_proxima','cuidado_preventivo','dieta_recomendada',
                          'alerta_salud','negocio_recomendado') NOT NULL,
    descripcion      TEXT            NOT NULL,
    razon_json       JSON            NULL COMMENT 'Factores que generaron la recomendación',
    -- Scoring IA
    score_relevancia DECIMAL(5,4)    NOT NULL DEFAULT 0.0000,
    modelo_ia        VARCHAR(60)     NULL COMMENT 'Versión del modelo que la generó',
    -- Interacción del usuario
    visualizada      BOOLEAN         NOT NULL DEFAULT FALSE,
    aceptada         BOOLEAN         NULL COMMENT 'NULL=sin respuesta, TRUE=aceptada, FALSE=rechazada',
    feedback_json    JSON            NULL COMMENT 'Feedback del usuario para mejorar el modelo',
    fecha_visualizacion DATETIME     NULL,
    fecha_generacion DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_expiracion DATETIME        NULL COMMENT 'Recomendaciones tienen vigencia limitada',
    PRIMARY KEY (id_recomendacion),
    INDEX idx_ia_usuario (id_usuario),
    INDEX idx_ia_mascota (id_mascota),
    INDEX idx_ia_tipo (tipo),
    INDEX idx_ia_score (score_relevancia),
    INDEX idx_ia_visualizada (visualizada),
    INDEX idx_ia_fecha (fecha_generacion),
    CONSTRAINT fk_ia_usuario
        FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_ia_mascota
        FOREIGN KEY (id_mascota) REFERENCES mascotas (id_mascota)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_ia_negocio
        FOREIGN KEY (id_negocio) REFERENCES negocios (id_negocio)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_ia_servicio
        FOREIGN KEY (id_servicio) REFERENCES servicios (id_servicio)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_ia_producto
        FOREIGN KEY (id_producto) REFERENCES productos (id_producto)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Recomendaciones generadas por IA para personalizar la experiencia del usuario';


-- ═══════════════════════════════════════════════════════════════════════════
--  DOMINIO 9: COMUNIDAD Y RESEÑAS
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE resenas (
    id_resena        INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    id_negocio       INT UNSIGNED    NOT NULL,
    id_usuario       INT UNSIGNED    NOT NULL,
    id_cita          INT UNSIGNED    NULL COMMENT 'Cita que originó la reseña',
    calificacion     TINYINT UNSIGNED NOT NULL COMMENT '1 a 5 estrellas',
    titulo           VARCHAR(150)    NULL,
    comentario       TEXT            NULL,
    -- Aspectos específicos (innovación: calificación granular)
    calif_atencion   TINYINT UNSIGNED NULL,
    calif_precio     TINYINT UNSIGNED NULL,
    calif_instalaciones TINYINT UNSIGNED NULL,
    calif_puntualidad TINYINT UNSIGNED NULL,
    -- Gestión
    respuesta_negocio TEXT           NULL,
    fecha_respuesta  DATETIME        NULL,
    visible          BOOLEAN         NOT NULL DEFAULT TRUE,
    reportada        BOOLEAN         NOT NULL DEFAULT FALSE,
    fecha_creacion   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id_resena),
    INDEX idx_resenas_negocio (id_negocio),
    INDEX idx_resenas_usuario (id_usuario),
    INDEX idx_resenas_calificacion (calificacion),
    INDEX idx_resenas_visible (visible),
    UNIQUE KEY uq_resena_cita (id_cita) COMMENT 'Una reseña por cita',
    CONSTRAINT fk_resenas_negocio
        FOREIGN KEY (id_negocio) REFERENCES negocios (id_negocio)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_resenas_usuario
        FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_resenas_cita
        FOREIGN KEY (id_cita) REFERENCES citas (id_cita)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT chk_calificacion CHECK (calificacion BETWEEN 1 AND 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Reseñas y calificaciones de usuarios a negocios tras una cita';


CREATE TABLE comunidad_posts (
    id_post          INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    id_usuario       INT UNSIGNED    NOT NULL,
    id_mascota       INT UNSIGNED    NULL,
    titulo           VARCHAR(200)    NULL,
    contenido        TEXT            NOT NULL,
    tipo             ENUM('experiencia','pregunta','consejo','foto','noticia','otro')
                     NOT NULL DEFAULT 'experiencia',
    imagenes_json    JSON            NULL COMMENT 'Array de URLs de imágenes',
    etiquetas_json   JSON            NULL COMMENT 'Tags: ["salud","nutricion","cachorro"]',
    total_likes      INT UNSIGNED    NOT NULL DEFAULT 0,
    total_comentarios INT UNSIGNED   NOT NULL DEFAULT 0,
    visible          BOOLEAN         NOT NULL DEFAULT TRUE,
    destacado        BOOLEAN         NOT NULL DEFAULT FALSE,
    fecha_creacion   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id_post),
    INDEX idx_posts_usuario (id_usuario),
    INDEX idx_posts_mascota (id_mascota),
    INDEX idx_posts_tipo (tipo),
    INDEX idx_posts_visible (visible),
    INDEX idx_posts_fecha (fecha_creacion),
    FULLTEXT INDEX ft_posts_busqueda (titulo, contenido),
    CONSTRAINT fk_posts_usuario
        FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_posts_mascota
        FOREIGN KEY (id_mascota) REFERENCES mascotas (id_mascota)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Publicaciones de la comunidad de dueños de mascotas';


CREATE TABLE comunidad_comentarios (
    id_comentario    INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    id_post          INT UNSIGNED    NOT NULL,
    id_usuario       INT UNSIGNED    NOT NULL,
    id_comentario_padre INT UNSIGNED NULL COMMENT 'Para respuestas anidadas',
    contenido        TEXT            NOT NULL,
    total_likes      INT UNSIGNED    NOT NULL DEFAULT 0,
    visible          BOOLEAN         NOT NULL DEFAULT TRUE,
    fecha_creacion   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id_comentario),
    INDEX idx_comentarios_post (id_post),
    INDEX idx_comentarios_usuario (id_usuario),
    INDEX idx_comentarios_padre (id_comentario_padre),
    CONSTRAINT fk_comentarios_post
        FOREIGN KEY (id_post) REFERENCES comunidad_posts (id_post)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_comentarios_usuario
        FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_comentarios_padre
        FOREIGN KEY (id_comentario_padre) REFERENCES comunidad_comentarios (id_comentario)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Comentarios y respuestas en los posts de la comunidad';


CREATE TABLE comunidad_likes (
    id_like          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    id_usuario       INT UNSIGNED    NOT NULL,
    id_post          INT UNSIGNED    NULL,
    id_comentario    INT UNSIGNED    NULL,
    fecha_creacion   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id_like),
    UNIQUE KEY uq_like_post (id_usuario, id_post),
    UNIQUE KEY uq_like_comentario (id_usuario, id_comentario),
    CONSTRAINT fk_likes_usuario
        FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_likes_post
        FOREIGN KEY (id_post) REFERENCES comunidad_posts (id_post)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_likes_comentario
        FOREIGN KEY (id_comentario) REFERENCES comunidad_comentarios (id_comentario)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Likes de usuarios a posts y comentarios de la comunidad';


-- ═══════════════════════════════════════════════════════════════════════════
--  DOMINIO 10: AUDITORÍA Y CONFIGURACIÓN GLOBAL
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE auditoria_global (
    id_auditoria     BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    id_usuario       INT UNSIGNED    NULL,
    tabla_afectada   VARCHAR(60)     NOT NULL,
    operacion        ENUM('INSERT','UPDATE','DELETE') NOT NULL,
    registro_id      BIGINT UNSIGNED NULL,
    datos_antes_json JSON            NULL,
    datos_despues_json JSON          NULL,
    ip_address       VARCHAR(45)     NULL,
    user_agent       VARCHAR(300)    NULL,
    fecha            DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id_auditoria),
    INDEX idx_auditoria_usuario (id_usuario),
    INDEX idx_auditoria_tabla (tabla_afectada),
    INDEX idx_auditoria_fecha (fecha),
    CONSTRAINT fk_auditoria_usuario
        FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Auditoría global de operaciones críticas del sistema';


CREATE TABLE configuracion_global (
    clave            VARCHAR(100)    NOT NULL,
    valor            TEXT            NOT NULL,
    tipo             ENUM('string','integer','boolean','json','decimal') NOT NULL DEFAULT 'string',
    descripcion      VARCHAR(300)    NULL,
    editable_admin   BOOLEAN         NOT NULL DEFAULT TRUE,
    fecha_actualizacion DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (clave)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Configuración global de la plataforma PetCat';


-- ═══════════════════════════════════════════════════════════════════════════
--  TRIGGERS
-- ═══════════════════════════════════════════════════════════════════════════

DELIMITER $$

-- Actualizar calificación promedio del negocio al agregar una reseña
CREATE TRIGGER trg_resenas_after_insert
AFTER INSERT ON resenas
FOR EACH ROW
BEGIN
    UPDATE negocios
    SET calificacion_promedio = (
            SELECT ROUND(AVG(calificacion), 2)
            FROM resenas
            WHERE id_negocio = NEW.id_negocio AND visible = TRUE
        ),
        total_resenas = (
            SELECT COUNT(*) FROM resenas
            WHERE id_negocio = NEW.id_negocio AND visible = TRUE
        )
    WHERE id_negocio = NEW.id_negocio;
END$$

-- Actualizar calificación promedio al eliminar o actualizar una reseña
CREATE TRIGGER trg_resenas_after_update
AFTER UPDATE ON resenas
FOR EACH ROW
BEGIN
    UPDATE negocios
    SET calificacion_promedio = (
            SELECT ROUND(AVG(calificacion), 2)
            FROM resenas
            WHERE id_negocio = NEW.id_negocio AND visible = TRUE
        ),
        total_resenas = (
            SELECT COUNT(*) FROM resenas
            WHERE id_negocio = NEW.id_negocio AND visible = TRUE
        )
    WHERE id_negocio = NEW.id_negocio;
END$$

-- Actualizar contador de likes en posts
CREATE TRIGGER trg_likes_post_after_insert
AFTER INSERT ON comunidad_likes
FOR EACH ROW
BEGIN
    IF NEW.id_post IS NOT NULL THEN
        UPDATE comunidad_posts
        SET total_likes = total_likes + 1
        WHERE id_post = NEW.id_post;
    END IF;
    IF NEW.id_comentario IS NOT NULL THEN
        UPDATE comunidad_comentarios
        SET total_likes = total_likes + 1
        WHERE id_comentario = NEW.id_comentario;
    END IF;
END$$

-- Actualizar contador de comentarios en posts
CREATE TRIGGER trg_comentarios_after_insert
AFTER INSERT ON comunidad_comentarios
FOR EACH ROW
BEGIN
    UPDATE comunidad_posts
    SET total_comentarios = total_comentarios + 1
    WHERE id_post = NEW.id_post;
END$$

-- Actualizar stock al registrar movimiento de inventario
CREATE TRIGGER trg_movinv_after_insert
AFTER INSERT ON movimientos_inventario
FOR EACH ROW
BEGIN
    UPDATE productos
    SET stock_actual = NEW.cantidad_nueva,
        fecha_actualizacion = CURRENT_TIMESTAMP
    WHERE id_producto = NEW.id_producto;
END$$

-- Generar recordatorio automático al confirmar una cita
CREATE TRIGGER trg_citas_after_update
AFTER UPDATE ON citas
FOR EACH ROW
BEGIN
    -- Si la cita pasa a confirmada, crear recordatorio automático
    IF NEW.estado = 'confirmada' AND OLD.estado != 'confirmada'
       AND NEW.recordatorio_enviado = FALSE THEN
        INSERT INTO recordatorios (
            id_usuario, id_mascota, id_cita, tipo,
            titulo, mensaje, canal, estado, fecha_programada
        ) VALUES (
            NEW.id_usuario, NEW.id_mascota, NEW.id_cita,
            'cita_recordatorio',
            'Recordatorio de tu cita',
            CONCAT('Tu cita está programada para el ', DATE_FORMAT(NEW.fecha, '%d/%m/%Y'),
                   ' a las ', TIME_FORMAT(NEW.hora_inicio, '%H:%i'), '. ¡Te esperamos!'),
            'push,whatsapp',
            'pendiente',
            DATE_SUB(CONCAT(NEW.fecha, ' ', NEW.hora_inicio), INTERVAL 2 HOUR)
        );
    END IF;
END$$

DELIMITER ;


-- ═══════════════════════════════════════════════════════════════════════════
--  DATOS INICIALES (SEED)
-- ═══════════════════════════════════════════════════════════════════════════

-- Planes de suscripción
INSERT INTO planes_suscripcion (nombre, descripcion, precio_mensual, precio_anual,
    max_sucursales, max_citas_mes, max_empleados, max_productos,
    estadisticas_avanzadas, soporte_prioritario, integracion_whatsapp,
    exportar_informes, ia_recomendaciones, api_personalizada,
    gestor_dedicado, sla_garantizado, capacitacion_incluida, orden_display)
VALUES
('Gratuito',
 'Plan de inicio para negocios pequeños. Sin costo, sin permanencia.',
 0.00, 0.00, 1, 30, 3, 50,
 FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, 1),

('Pro',
 'Para negocios en crecimiento. Estadísticas, WhatsApp y citas ilimitadas.',
 120000.00, 1080000.00, 3, -1, -1, -1,
 TRUE, TRUE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE, FALSE, 2),

('Enterprise',
 'Para clínicas y cadenas. Todo incluido, gestor dedicado y SLA garantizado.',
 280000.00, 2520000.00, -1, -1, -1, -1,
 TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, 3);


-- Roles predefinidos del sistema
INSERT INTO roles (nombre, descripcion, permisos_json, es_sistema) VALUES
('Administrador',
 'Acceso total al panel del negocio. Puede editar todo.',
 '{"citas":["ver","crear","editar","cancelar"],"servicios":["ver","crear","editar","eliminar"],"inventario":["ver","crear","editar","eliminar","editar_stock"],"clientes":["ver","editar"],"empleados":["ver","crear","editar","eliminar"],"pagos":["ver","ver_basico","reembolsar"],"roles":["ver","crear","editar","eliminar"],"reportes":["ver","exportar"],"configuracion":["ver","editar"],"historial_medico":["ver","crear","editar"],"vacunas":["ver","crear","editar"]}',
 TRUE),

('Veterinario',
 'Puede gestionar citas, mascotas, historial médico y servicios.',
 '{"citas":["ver","crear","editar"],"servicios":["ver"],"inventario":["ver","editar_stock"],"clientes":["ver"],"historial_medico":["ver","crear","editar"],"vacunas":["ver","crear"]}',
 TRUE),

('Recepcionista',
 'Solo gestiona citas y clientes. No accede a reportes financieros.',
 '{"citas":["ver","crear","editar","cancelar"],"servicios":["ver"],"clientes":["ver"],"pagos":["ver_basico"]}',
 TRUE);


-- Categorías de servicio
INSERT INTO categorias_servicio (nombre, descripcion, icono, orden_display) VALUES
('Consulta y diagnóstico',  'Consultas generales, urgencias y diagnóstico clínico', 'stethoscope', 1),
('Vacunación',              'Vacunas individuales y paquetes completos',             'syringe',     2),
('Baño y estética',         'Baño, corte, peluquería y spa para mascotas',           'bath',        3),
('Cirugía',                 'Cirugías menores, mayores y procedimientos quirúrgicos','scissors',    4),
('Desparasitación',         'Tratamientos antiparasitarios internos y externos',     'pill',        5),
('Hospitalización',         'Internación y cuidados intensivos',                     'hospital',    6),
('Laboratorio y diagnóstico','Exámenes de laboratorio, radiografías y ecografías',   'microscope',  7),
('Guardería',               'Guardería diurna y nocturna para mascotas',             'home',        8),
('Entrenamiento',           'Adiestramiento básico y avanzado',                      'award',       9),
('Nutrición',               'Asesoría nutricional y planes de alimentación',         'heart',       10);


-- Categorías de producto
INSERT INTO categorias_producto (nombre, descripcion) VALUES
('Medicamentos',            'Antibióticos, antiparasitarios, vitaminas y tratamientos'),
('Vacunas',                 'Vacunas comerciales refrigeradas'),
('Alimentos y suplementos', 'Concentrados, premios y suplementos nutricionales'),
('Accesorios',              'Collares, correas, juguetes y artículos para mascotas'),
('Higiene y estética',      'Shampoos, cepillos, cortaúñas y productos de aseo'),
('Insumos veterinarios',    'Jeringas, guantes, gasas y materiales clínicos'),
('Equipos',                 'Equipos médicos, jaulas y accesorios de clínica');


-- Configuración global inicial
INSERT INTO configuracion_global (clave, valor, tipo, descripcion) VALUES
('app_nombre',              'PetCat',                           'string',  'Nombre de la plataforma'),
('app_version',             '1.0.0',                            'string',  'Versión actual de la app'),
('moneda_default',          'COP',                              'string',  'Moneda por defecto'),
('ciudad_default',          'Sincelejo',                        'string',  'Ciudad principal de operación'),
('pais_default',            'Colombia',                         'string',  'País de operación'),
('comision_plataforma_pct', '4.00',                             'decimal', 'Comisión de PetCat sobre ventas (%)'),
('dias_prueba_gratis',      '14',                               'integer', 'Días de prueba gratuita para plan Pro'),
('max_fotos_post',          '5',                                'integer', 'Máximo de fotos por post en comunidad'),
('radio_busqueda_km',       '10',                               'integer', 'Radio de búsqueda de negocios cercanos por defecto'),
('whatsapp_recordatorio_h', '2',                                'integer', 'Horas antes de la cita para enviar recordatorio'),
('ia_modelo',               'gpt-4o-mini',                      'string',  'Modelo de IA para recomendaciones'),
('mantenimiento',           'false',                            'boolean', 'Modo mantenimiento activo/inactivo'),
('contacto_soporte',        'soporte@petcat.com.co',            'string',  'Email de soporte de la plataforma'),
('terminos_version',        '1.0',                              'string',  'Versión actual de los términos de uso');


-- ═══════════════════════════════════════════════════════════════════════════
--  VISTAS ÚTILES PARA EL PANEL WEB
-- ═══════════════════════════════════════════════════════════════════════════

-- Vista de citas con toda la información relacionada
CREATE OR REPLACE VIEW v_citas_detalle AS
SELECT
    c.id_cita,
    c.fecha,
    c.hora_inicio,
    c.hora_fin,
    c.estado,
    c.precio_final,
    c.prioridad,
    c.origen,
    c.notas_cliente,
    c.fecha_creacion,
    -- Negocio
    n.id_negocio,
    n.nombre AS negocio_nombre,
    n.tipo AS negocio_tipo,
    -- Sucursal
    s.id_sucursal,
    s.nombre AS sucursal_nombre,
    -- Usuario (dueño)
    u.id_usuario,
    CONCAT(u.nombre, ' ', u.apellido) AS usuario_nombre,
    u.email AS usuario_email,
    u.telefono AS usuario_telefono,
    -- Mascota
    m.id_mascota,
    m.nombre AS mascota_nombre,
    m.especie AS mascota_especie,
    m.raza AS mascota_raza,
    -- Servicio
    sv.id_servicio,
    sv.nombre AS servicio_nombre,
    sv.precio_base AS servicio_precio,
    sv.duracion_minutos,
    -- Empleado
    e.id_empleado,
    CONCAT(e.nombre, ' ', e.apellido) AS empleado_nombre,
    e.especialidad AS empleado_especialidad
FROM citas c
INNER JOIN negocios n     ON c.id_negocio  = n.id_negocio
LEFT  JOIN sucursales s   ON c.id_sucursal = s.id_sucursal
INNER JOIN usuarios u     ON c.id_usuario  = u.id_usuario
INNER JOIN mascotas m     ON c.id_mascota  = m.id_mascota
INNER JOIN servicios sv   ON c.id_servicio = sv.id_servicio
LEFT  JOIN empleados e    ON c.id_empleado = e.id_empleado;


-- Vista de productos con alerta de stock bajo
CREATE OR REPLACE VIEW v_productos_stock AS
SELECT
    p.id_producto,
    p.nombre,
    p.marca,
    p.codigo_sku,
    p.stock_actual,
    p.stock_minimo,
    p.precio_venta,
    p.fecha_vencimiento,
    cp.nombre AS categoria,
    n.nombre AS negocio,
    CASE
        WHEN p.stock_actual = 0                       THEN 'agotado'
        WHEN p.stock_actual <= p.stock_minimo         THEN 'stock_bajo'
        WHEN p.fecha_vencimiento IS NOT NULL
             AND p.fecha_vencimiento <= DATE_ADD(CURDATE(), INTERVAL 30 DAY) THEN 'por_vencer'
        ELSE 'ok'
    END AS estado_stock,
    ROUND(p.precio_venta - p.precio_compra, 2) AS margen_bruto,
    ROUND(((p.precio_venta - p.precio_compra) / NULLIF(p.precio_compra, 0)) * 100, 2) AS margen_pct
FROM productos p
INNER JOIN categorias_producto cp ON p.id_categoria = cp.id_categoria
INNER JOIN negocios n             ON p.id_negocio   = n.id_negocio
WHERE p.activo = TRUE;


-- Vista de resumen de mascotas con salud
CREATE OR REPLACE VIEW v_mascotas_salud AS
SELECT
    m.id_mascota,
    m.nombre,
    m.especie,
    m.raza,
    m.fecha_nacimiento,
    TIMESTAMPDIFF(MONTH, m.fecha_nacimiento, CURDATE()) AS edad_meses,
    m.peso,
    m.esterilizado,
    u.id_usuario,
    CONCAT(u.nombre, ' ', u.apellido) AS propietario,
    u.telefono AS propietario_telefono,
    -- Vacunas próximas o vencidas
    (SELECT COUNT(*) FROM vacunas v
     WHERE v.id_mascota = m.id_mascota AND v.estado IN ('proximo','vencido')) AS vacunas_pendientes,
    -- Última cita
    (SELECT MAX(fecha) FROM citas c
     WHERE c.id_mascota = m.id_mascota AND c.estado = 'completada') AS ultima_cita,
    -- Próxima cita
    (SELECT MIN(fecha) FROM citas c
     WHERE c.id_mascota = m.id_mascota
       AND c.estado IN ('pendiente','confirmada')
       AND c.fecha >= CURDATE()) AS proxima_cita
FROM mascotas m
INNER JOIN usuarios u ON m.id_usuario = u.id_usuario
WHERE m.activo = TRUE AND m.fallecido = FALSE;


-- Vista de ingresos por negocio
CREATE OR REPLACE VIEW v_ingresos_negocio AS
SELECT
    n.id_negocio,
    n.nombre AS negocio,
    DATE_FORMAT(p.fecha_pago, '%Y-%m') AS mes,
    COUNT(p.id_pago) AS total_transacciones,
    ROUND(SUM(p.monto), 2) AS ingresos_totales,
    ROUND(SUM(CASE WHEN p.id_cita IS NOT NULL THEN p.monto ELSE 0 END), 2) AS ingresos_citas,
    ROUND(SUM(CASE WHEN p.id_compra IS NOT NULL THEN p.monto ELSE 0 END), 2) AS ingresos_tienda
FROM pagos p
INNER JOIN negocios n ON p.id_negocio = n.id_negocio
WHERE p.estado = 'aprobado'
GROUP BY n.id_negocio, n.nombre, DATE_FORMAT(p.fecha_pago, '%Y-%m');


SET FOREIGN_KEY_CHECKS = 1;

-- ═══════════════════════════════════════════════════════════════════════════
--  FIN DEL SCRIPT
--  PetCat Database v1.0 — CECAR 2026
--  Tablas: 27 | Relaciones: 48 FK | Triggers: 6 | Vistas: 4
-- ═══════════════════════════════════════════════════════════════════════════