import swaggerJSDoc from "swagger-jsdoc";

const swaggerSpec = swaggerJSDoc({
  definition: {
    openapi: "3.0.0",
    info: {
      title: "PetCat API",
      version: "1.0.0",
      description:
        "API profesional de PetCat - sistema de gestión de usuarios, negocios y mascotas",
    },
    servers: [
      {
        url: "http://localhost:3000/api",
        description: "Servidor local",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
    security: [
        {
            bearerAuth: [],
        },
      ],
  },
  apis: ["./src/modules/**/*.routes.js"],
});

export default swaggerSpec;