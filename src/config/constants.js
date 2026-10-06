// En producción lo pondremos como variable de entorno en Azure
const VERIFY_TOKEN =
    process.env.VERIFY_TOKEN || "nearmiss_hudson_token";

const CONSEQUENCES = {
    "1": "Golpe",
    "2": "Caída",
    "3": "Atrapamiento",
    "4": "Cortadura",
    "5": "Quemadura",
    "6": "Derrame",
    "7": "Daño a equipo",
    "8": "Otro"
};

const AREAS = {
    "1": "Estructuras",
    "2": "Plasticos",
    "3": "Headers",
    "4": "Almacen",
    "5": "Embarques",
    "6": "Calidad",
    "7": "Vigilancia",
    "8": "Oficinas Generales"
}

const ALLOWED_IMAGE_TYPES = [
    "image/jpeg",
    "image/jpg",
    "image/png"
];

module.exports = { CONSEQUENCES, AREAS, ALLOWED_IMAGE_TYPES, VERIFY_TOKEN };
