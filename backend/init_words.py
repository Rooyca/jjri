from database import SessionLocal, init_db
from crud import bulk_create_words

def populate_words():
    """Populate the words table with Spanish words."""
    init_db()
    db = SessionLocal()
    
    try:
        tech_words = [
            "rapido", "cafe", "zorro", "saltos", "terminar", "lento", "perro",
            "python", "javascript", "programacion", "codigo", "funcion", "variable",
            "algoritmos", "computador", "teclado", "monitor", "desarrollador", "software",
            "datos", "redes", "seguridad", "sistemas", "aplicacion", "interfaces",
            "diseño", "testear", "bug", "despliegue", "version", "control",
            "framework", "libreria", "modulo", "paquete", "instalar", "ejecutar",
            "compilar", "runtime", "sintaxis", "semantica", "logica", "booleano",
            "string", "entero", "array", "objeto", "clase", "metodo",
            "propiedad", "atributo", "parametro", "argumento", "retorno", "valor",
            "bucle", "condicion", "iteracion", "recursividad", "memoria", "puntero",
            "referencia", "stack", "fila", "arbol", "grafico", "hash", "hardware",
            "ordenar", "buscar", "binario", "linear", "burbuja", "merge",
            "heap", "insertar", "seleccionar", "radix", "bucket",
            "profundidad", "trasversal", "nodo", "edge",
            "ancho", "distancia", "rama", "ciclo", "conectado", "redireccion",
            "matrix", "vector", "tensor", "escalar", "dimension",
            "coordenadas", "axis", "plano", "espacio", "transformar", "rotar"
        ]
        
        additional_words = [
            # Common verbs
            "caminar", "correr", "saltar", "bailar", "cantar", "escribir", "leer",
            "hablar", "escuchar", "mirar", "pensar", "sentir", "creer", "saber",
            "conocer", "vivir", "morir", "nacer", "crecer", "aprender", "enseñar",
            "trabajar", "jugar", "dormir", "despertar", "comer", "beber", "cocinar",
            "comprar", "vender", "pagar", "ahorrar", "gastar", "ganar", "perder",
            "buscar", "encontrar", "llevar", "traer", "enviar", "recibir",
            
            # Common nouns
            "casa", "puerta", "ventana", "pared", "techo", "suelo", "escalera",
            "mesa", "silla", "cama", "sofa", "armario", "espejo", "lampara",
            "libro", "cuaderno", "lapiz", "pluma", "papel", "carpeta", "mochila",
            "reloj", "telefono", "computadora", "pantalla", "raton", "camara",
            "auto", "bicicleta", "moto", "autobus", "tren", "avion", "barco",
            "calle", "avenida", "carretera", "puente", "edificio", "parque", "plaza",
            "escuela", "universidad", "biblioteca", "museo", "hospital", "tienda",
            "restaurante", "banco", "oficina", "fabrica", "mercado", "gimnasio",
            
            # Nature and animals
            "sol", "luna", "estrella", "cielo", "nube", "lluvia", "viento", "nieve",
            "montaña", "valle", "rio", "lago", "mar", "oceano", "playa", "isla",
            "bosque", "selva", "desierto", "pradera", "flor", "arbol", "planta",
            "gato", "perro", "pajaro", "pez", "caballo", "vaca", "oveja", "cerdo",
            "leon", "tigre", "elefante", "mono", "serpiente", "tortuga", "conejo",
            
            # Food and drinks
            "pan", "arroz", "pasta", "carne", "pollo", "pescado", "huevo", "leche",
            "queso", "mantequilla", "aceite", "sal", "azucar", "harina", "fruta",
            "manzana", "naranja", "platano", "uva", "fresa", "sandia", "melon",
            "tomate", "lechuga", "cebolla", "zanahoria", "papa", "maiz", "frijol",
            "agua", "jugo", "refresco", "cerveza", "vino", "cafe", "chocolate",
            
            # Colors and qualities
            "rojo", "azul", "verde", "amarillo", "negro", "blanco", "gris", "rosa",
            "grande", "pequeño", "alto", "bajo", "largo", "corto", "ancho", "estrecho",
            "nuevo", "viejo", "joven", "antiguo", "moderno", "fuerte", "debil",
            "rapido", "lento", "facil", "dificil", "bueno", "malo", "bonito", "feo",
            "limpio", "sucio", "lleno", "vacio", "caliente", "frio", "dulce", "amargo",
            
            # Time and numbers
            "dia", "noche", "mañana", "tarde", "hora", "minuto", "segundo", "semana",
            "mes", "año", "siglo", "hoy", "ayer", "mañana", "ahora", "antes", "despues",
            "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve",
            "diez", "veinte", "treinta", "cien", "mil", "millon", "primero", "segundo",
            
            # People and relationships
            "persona", "hombre", "mujer", "niño", "niña", "bebe", "adulto", "anciano",
            "familia", "padre", "madre", "hijo", "hija", "hermano", "hermana", "abuelo",
            "abuela", "tio", "tia", "primo", "prima", "amigo", "amiga", "novio", "novia",
            "esposo", "esposa", "maestro", "estudiante", "doctor", "enfermera", "policia",
            
            # Actions and states
            "abrir", "cerrar", "subir", "bajar", "entrar", "salir", "llegar", "partir",
            "empezar", "terminar", "continuar", "parar", "ayudar", "preguntar", "responder",
            "dar", "tomar", "poner", "quitar", "hacer", "romper", "arreglar", "limpiar",
            "construir", "destruir", "crear", "imaginar", "recordar", "olvidar",
            
            # Abstract concepts
            "amor", "odio", "paz", "guerra", "verdad", "mentira", "bien", "mal",
            "vida", "muerte", "tiempo", "espacio", "causa", "efecto", "razon", "emocion",
            "idea", "pensamiento", "opinion", "decision", "problema", "solucion",
            "objetivo", "meta", "exito", "fracaso", "esperanza", "miedo", "alegria"
        ]
        
        # Combine all words and remove duplicates
        all_words = list(set(tech_words + additional_words))
        
        # Insert in bulk
        bulk_create_words(db, all_words, language="es", category="general")
        
        print(f"Successfully inserted {len(all_words)} Spanish words into the database!")
        
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    populate_words()
