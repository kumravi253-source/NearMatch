// Global JS error handlers to capture rendering and unhandled promise errors
// Adds clear log markers that can be searched in simulator logs: GLOBAL_RENDER_ERROR and GLOBAL_UNHANDLED_REJECTION

function globalErrorHandler(error, isFatal) {
  try {
    console.error('GLOBAL_RENDER_ERROR', isFatal ? 'FATAL' : 'NONFATAL', error && error.message);
    if (error && error.stack) console.error(error.stack);
  } catch (e) {
    // swallow
  }
  // Call default handler if present
  try {
    if (typeof ErrorUtils !== 'undefined' && ErrorUtils.getGlobalHandler) {
      const defaultHandler = ErrorUtils.getGlobalHandler();
      if (typeof defaultHandler === 'function') defaultHandler(error, isFatal);
    }
  } catch (e) {}
}

if (typeof ErrorUtils !== 'undefined' && ErrorUtils.setGlobalHandler) {
  try { ErrorUtils.setGlobalHandler(globalErrorHandler); } catch (e) {}
}

// Unhandled promise rejections
if (typeof global !== 'undefined' && global && typeof global.process === 'object' && typeof global.process.on === 'function') {
  try {
    global.process.on('unhandledRejection', (reason) => {
      console.error('GLOBAL_UNHANDLED_REJECTION', reason);
    });
  } catch (e) {}
}

// Also attach basic window handler if available
if (typeof window !== 'undefined' && window && typeof window.addEventListener === 'function') {
  try {
    window.addEventListener('unhandledrejection', (evt) => {
      console.error('GLOBAL_UNHANDLED_REJECTION', evt && evt.reason);
    });
  } catch (e) {}
}

export default true;
