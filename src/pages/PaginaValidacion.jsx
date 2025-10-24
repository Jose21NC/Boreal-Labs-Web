import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useSearchParams } from 'react-router-dom'; // Hook para leer parámetros de URL
import { motion } from 'framer-motion';
import { db } from '@/firebase.jsx'; // Asegúrate que la ruta sea correcta
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { Loader2, CheckCircle, XCircle } from 'lucide-react'; // Iconos para estados

const PaginaValidacion = () => {
  // Hook para leer los parámetros de búsqueda de la URL
  const [searchParams, setSearchParams] = useSearchParams();
  const validationId = searchParams.get('id'); // Obtiene el valor del parámetro 'id'

  // Estado para el input de búsqueda (ID de validación)
  const [inputId, setInputId] = useState(validationId || '');

  // Estados para manejar la UI
  const [status, setStatus] = useState('loading'); // 'loading', 'success', 'error'
  const [certificateData, setCertificateData] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    // Mantener el input sincronizado si el parámetro de URL cambia externamente
    setInputId(validationId || '');

    // Función asíncrona para buscar el certificado en Firestore
    const validateCertificate = async () => {
      setStatus('loading'); // Empieza en estado de carga

      // Si no hay ID en la URL, establece estado de error directamente
      if (!validationId) {
        setErrorMessage('No se proporcionó un ID de validación.');
        setStatus('error');
        return;
      }

      try {
        // 1. Define la colección donde buscar
        const certificatesRef = collection(db, 'certificados');
        
        // 2. Crea la consulta: buscar donde 'idValidacion' sea igual al ID de la URL
        const q = query(certificatesRef, where('idValidacion', '==', validationId));

        // 3. Ejecuta la consulta
        const querySnapshot = await getDocs(q);

        // 4. Procesa los resultados
        if (querySnapshot.empty) {
          // No se encontró ningún documento
          setErrorMessage('Este código de validación no es válido o no se encuentra en nuestros registros.');
          setStatus('error');
        } else {
          // Se encontró al menos un documento (asumimos que idValidacion es único)
          // Tomamos el primer resultado
          const docData = querySnapshot.docs[0].data();
          setCertificateData(docData);
          setStatus('success');
        }
      } catch (err) {
        console.error("Error al validar certificado:", err);
        setErrorMessage('Ocurrió un error al intentar validar el certificado. Inténtalo más tarde.');
        setStatus('error');
      }
    };

    validateCertificate(); // Llama a la función al cargar la página

  }, [validationId]); // Este efecto se re-ejecuta si el 'id' en la URL cambia

  // Handler cuando el usuario envía el formulario de búsqueda
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const id = (inputId || '').toString().trim();
    if (!id) {
      setErrorMessage('Por favor ingresa un ID de validación.');
      setStatus('error');
      return;
    }
    // Actualiza la URL con el parámetro ?id=... lo que disparará el useEffect
    setSearchParams({ id });
  };

  // Función para formatear la fecha de Firestore (Timestamp)
  const formatFirestoreDate = (timestamp) => {
    if (timestamp instanceof Timestamp) {
      return timestamp.toDate().toLocaleDateString('es-NI', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    }
    return 'Fecha no disponible'; // Fallback si el formato no es correcto
  };

  return (
    <>
      <Helmet>
        <title>Validar Certificado - Boreal Labs</title>
        <meta name="description" content="Verifica la autenticidad de un certificado emitido por Boreal Labs." />
      </Helmet>

      <div className="pt-32 pb-20 bg-boreal-dark flex items-center justify-center min-h-screen text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 glass-effect rounded-2xl p-8 md:p-12"
        >
          <h1 className="text-3xl md:text-4xl font-bold text-gradient mb-8">
            Validación de Certificado
          </h1>

          {/* Cuadro de búsqueda para ingresar ID de validación */}
          <form onSubmit={handleSearchSubmit} className="mb-6 flex items-center justify-center">
            <input
              type="text"
              placeholder="Ingresa el ID de validación"
              value={inputId}
              onChange={(e) => setInputId(e.target.value)}
              className="w-full max-w-md bg-gray-800 border border-gray-700 text-white px-4 py-2 rounded-l-md focus:outline-none"
              aria-label="ID de validación"
            />
            <button
              type="submit"
              className="bg-gradient-to-r from-boreal-blue to-boreal-purple text-white px-4 py-2 rounded-r-md ml-2 font-semibold"
            >Buscar</button>
          </form>

          {/* Estado de Carga */}
          {status === 'loading' && (
            <div className="flex flex-col items-center text-boreal-aqua">
              <Loader2 className="w-16 h-16 animate-spin mb-4" />
              <p className="text-xl">Validando certificado...</p>
            </div>
          )}

          {/* Estado de Éxito */}
          {status === 'success' && certificateData && (
            <div className="text-left space-y-4">
              <div className="flex items-center justify-center text-green-400 mb-6">
                <CheckCircle className="w-16 h-16 mr-3" />
                <p className="text-2xl font-bold">Certificado Válido</p>
              </div>
              <p className="text-lg text-gray-300">
                Este documento certifica que{' '}
                <strong className="text-white">{certificateData.nombreUsuario || 'Nombre no disponible'}</strong>{' '}
                completó exitosamente el evento{' '}
                <strong className="text-white">{certificateData.nombreEvento || 'Evento no disponible'}</strong>{' '}
                en la fecha{' '}
                <strong className="text-white">{formatFirestoreDate(certificateData.fechaEmision)}</strong>.
              </p>
              {/* Mostrar modalidad (presencial / virtual) */}
              <p className="text-sm text-gray-400 mt-2">
                Modalidad: <strong className="text-white">{certificateData.modalidad || 'No especificada'}</strong>
              </p>
              {/* Puedes añadir más detalles aquí si los tienes en Firestore */}
              {/* <p className="text-sm text-gray-400">ID de Validación: {validationId}</p> */}
            </div>
          )}

          {/* Estado de Error */}
          {status === 'error' && (
            <div className="text-center space-y-4">
              <div className="flex items-center justify-center text-red-400 mb-6">
                <XCircle className="w-16 h-16 mr-3" />
                <p className="text-2xl font-bold">Certificado No Válido</p>
              </div>
              <p className="text-lg text-gray-300">
                {errorMessage}
              </p>
              <p className="text-sm text-gray-400">
                Si crees que esto es un error, por favor contacta a Boreal Labs.
              </p>
            </div>
          )}
        </motion.div>
      </div>
    </>
  );
};

export default PaginaValidacion;
