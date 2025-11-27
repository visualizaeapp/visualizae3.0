
console.log('Testing jwa import...');
try {
    require('jwa');
    console.log('jwa imported successfully');
} catch (e) {
    console.error('Failed to import jwa:', e);
}
