// Get the current hostname to determine the correct authDomain
const getAuthDomain = () => {
  if (typeof window === 'undefined') {
    // Server-side: use default Firebase authDomain
    return "visualizae-3-0-app.firebaseapp.com";
  }

  const hostname = window.location.hostname;

  // If on custom domain, use it as authDomain
  if (hostname === 'www.visualizae.com' || hostname === 'visualizae.com') {
    return hostname;
  }

  // Otherwise use Firebase default authDomain
  return "visualizae-3-0-app.firebaseapp.com";
};

export const firebaseConfig = {
  "apiKey": "AIzaSyBsvcMmGIGb5CobOHZswOjSq8owF8VftfQ",
  "authDomain": getAuthDomain(),
  "projectId": "visualizae-3-0-app",
  "storageBucket": "visualizae-3-0-app.firebasestorage.app",
  "messagingSenderId": "796518112786",
  "appId": "1:796518112786:web:9af709ec8673939fcf82cb"
};
