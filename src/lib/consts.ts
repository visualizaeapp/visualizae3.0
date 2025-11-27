
import type { AspectRatio } from '@/types';

export const ASPECT_RATIOS: AspectRatio[] = [
    { name: 'Square', ratio: 1.00, dimensions: '1024 / 1024', pixels: '1024x1024', megapixels: 1.05 },

    // Cinematic
    { name: 'Cinematic', ratio: 4.00, dimensions: '2048 / 512', pixels: '2048x512', megapixels: 1.05 },
    { name: 'Vertical Cinematic', ratio: 0.25, dimensions: '512 / 2048', pixels: '512x2048', megapixels: 1.05 },

    // Ultra Wide
    { name: 'Ultra Wide', ratio: 2.79, dimensions: '1696 / 608', pixels: '1696x608', megapixels: 1.03 },
    { name: 'Vertical Ultra Wide', ratio: 0.36, dimensions: '608 / 1696', pixels: '608x1696', megapixels: 1.03 },

    // Wide
    { name: 'Wide', ratio: 1.91, dimensions: '1408 / 736', pixels: '1408x736', megapixels: 1.04 },
    { name: 'Vertical Wide', ratio: 0.52, dimensions: '736 / 1408', pixels: '736x1408', megapixels: 1.04 },

    // Landscape/Portrait
    { name: 'Landscape', ratio: 1.75, dimensions: '1344 / 768', pixels: '1344x768', megapixels: 1.03 },
    { name: 'Portrait', ratio: 0.57, dimensions: '768 / 1344', pixels: '768x1344', megapixels: 1.03 },

    // Widescreen
    { name: 'Widescreen', ratio: 1.60, dimensions: '1280 / 800', pixels: '1280x800', megapixels: 1.02 },
    { name: 'Vertical Widescreen', ratio: 0.63, dimensions: '800 / 1280', pixels: '800x1280', megapixels: 1.02 },

    // Standard/Tall
    { name: 'Standard', ratio: 1.37, dimensions: '1184 / 864', pixels: '1184x864', megapixels: 1.02 },
    { name: 'Tall', ratio: 0.73, dimensions: '864 / 1184', pixels: '864x1184', megapixels: 1.02 },

    // Photo
    { name: 'Photo', ratio: 1.29, dimensions: '1152 / 896', pixels: '1152x896', megapixels: 1.03 },
    { name: 'Vertical Photo', ratio: 0.78, dimensions: '896 / 1152', pixels: '896x1152', megapixels: 1.03 },

    // New Ratios
    { name: '1056x992', ratio: 1.06, dimensions: '1056 / 992', pixels: '1056x992', megapixels: 1.05 },
    { name: '992x1056', ratio: 0.94, dimensions: '992 / 1056', pixels: '992x1056', megapixels: 1.05 },

    { name: '1088x960', ratio: 1.13, dimensions: '1088 / 960', pixels: '1088x960', megapixels: 1.04 },
    { name: '960x1088', ratio: 0.88, dimensions: '960 / 1088', pixels: '960x1088', megapixels: 1.04 },

    { name: '1632x640', ratio: 2.55, dimensions: '1632 / 640', pixels: '1632x640', megapixels: 1.04 },
    { name: '640x1632', ratio: 0.39, dimensions: '640 / 1632', pixels: '640x1632', megapixels: 1.04 },

    { name: '1920x544', ratio: 3.53, dimensions: '1920 / 544', pixels: '1920x544', megapixels: 1.04 },
    { name: '544x1920', ratio: 0.28, dimensions: '544 / 1920', pixels: '544x1920', megapixels: 1.04 },

    { name: '1120x928', ratio: 1.21, dimensions: '1120 / 928', pixels: '1120x928', megapixels: 1.04 },
    { name: '928x1120', ratio: 0.83, dimensions: '928 / 1120', pixels: '928x1120', megapixels: 1.04 },

    { name: '1248x832', ratio: 1.50, dimensions: '1248 / 832', pixels: '1248x832', megapixels: 1.04 },
    { name: '832x1248', ratio: 0.67, dimensions: '832 / 1248', pixels: '832x1248', megapixels: 1.04 },

    { name: '1472x704', ratio: 2.09, dimensions: '1472 / 704', pixels: '1472x704', megapixels: 1.04 },
    { name: '704x1472', ratio: 0.48, dimensions: '704 / 1472', pixels: '704x1472', megapixels: 1.04 },

    { name: '1536x672', ratio: 2.29, dimensions: '1536 / 672', pixels: '1536x672', megapixels: 1.03 },
    { name: '672x1536', ratio: 0.44, dimensions: '672 / 1536', pixels: '672x1536', megapixels: 1.03 },

    { name: '1792x576', ratio: 3.11, dimensions: '1792 / 576', pixels: '1792x576', megapixels: 1.03 },
    { name: '576x1792', ratio: 0.32, dimensions: '576 / 1792', pixels: '576x1792', megapixels: 1.03 },
];

export const PRO_ASPECT_RATIOS: AspectRatio[] = [
    // Square
    { name: 'Square', ratio: 1.00, dimensions: '2048 / 2048', pixels: '2048x2048', megapixels: 4.19 },

    // Row 1
    { name: '4096x1056', ratio: 3.88, dimensions: '4096 / 1056', pixels: '4096x1056', megapixels: 4.33 },
    { name: '1056x4096', ratio: 0.26, dimensions: '1056 / 4096', pixels: '1056x4096', megapixels: 4.33 },

    { name: '2944x1440', ratio: 2.04, dimensions: '2944 / 1440', pixels: '2944x1440', megapixels: 4.24 },
    { name: '1440x2944', ratio: 0.49, dimensions: '1440 / 2944', pixels: '1440x2944', megapixels: 4.24 },

    { name: '2432x1760', ratio: 1.38, dimensions: '2432 / 1760', pixels: '2432x1760', megapixels: 4.28 },
    { name: '1760x2432', ratio: 0.72, dimensions: '1760 / 2432', pixels: '1760x2432', megapixels: 4.28 },

    // Row 2
    { name: '3936x1088', ratio: 3.62, dimensions: '3936 / 1088', pixels: '3936x1088', megapixels: 4.28 },
    { name: '1088x3936', ratio: 0.28, dimensions: '1088 / 3936', pixels: '1088x3936', megapixels: 4.28 },

    { name: '2880x1472', ratio: 1.96, dimensions: '2880 / 1472', pixels: '2880x1472', megapixels: 4.24 },
    { name: '1472x2880', ratio: 0.51, dimensions: '1472 / 2880', pixels: '1472x2880', megapixels: 4.24 },

    { name: '2400x1792', ratio: 1.34, dimensions: '2400 / 1792', pixels: '2400x1792', megapixels: 4.30 },
    { name: '1792x2400', ratio: 0.75, dimensions: '1792 / 2400', pixels: '1792x2400', megapixels: 4.30 },

    // Row 3
    { name: '3808x1120', ratio: 3.40, dimensions: '3808 / 1120', pixels: '3808x1120', megapixels: 4.26 },
    { name: '1120x3808', ratio: 0.29, dimensions: '1120 / 3808', pixels: '1120x3808', megapixels: 4.26 },

    { name: '2848x1504', ratio: 1.89, dimensions: '2848 / 1504', pixels: '2848x1504', megapixels: 4.28 },
    { name: '1504x2848', ratio: 0.53, dimensions: '1504 / 2848', pixels: '1504x2848', megapixels: 4.28 },

    { name: '2336x1824', ratio: 1.28, dimensions: '2336 / 1824', pixels: '2336x1824', megapixels: 4.26 },
    { name: '1824x2336', ratio: 0.78, dimensions: '1824 / 2336', pixels: '1824x2336', megapixels: 4.26 },

    // Row 4
    { name: '3680x1152', ratio: 3.19, dimensions: '3680 / 1152', pixels: '3680x1152', megapixels: 4.24 },
    { name: '1152x3680', ratio: 0.31, dimensions: '1152 / 3680', pixels: '1152x3680', megapixels: 4.24 },

    { name: '2784x1536', ratio: 1.81, dimensions: '2784 / 1536', pixels: '2784x1536', megapixels: 4.28 },
    { name: '1536x2784', ratio: 0.55, dimensions: '1536 / 2784', pixels: '1536x2784', megapixels: 4.28 },

    { name: '2304x1856', ratio: 1.24, dimensions: '2304 / 1856', pixels: '2304x1856', megapixels: 4.28 },
    { name: '1856x2304', ratio: 0.81, dimensions: '1856 / 2304', pixels: '1856x2304', megapixels: 4.28 },

    // Row 5
    { name: '3584x1184', ratio: 3.03, dimensions: '3584 / 1184', pixels: '3584x1184', megapixels: 4.24 },
    { name: '1184x3584', ratio: 0.33, dimensions: '1184 / 3584', pixels: '1184x3584', megapixels: 4.24 },

    { name: '2752x1568', ratio: 1.76, dimensions: '2752 / 1568', pixels: '2752x1568', megapixels: 4.32 },
    { name: '1568x2752', ratio: 0.57, dimensions: '1568 / 2752', pixels: '1568x2752', megapixels: 4.32 },

    { name: '2272x1888', ratio: 1.20, dimensions: '2272 / 1888', pixels: '2272x1888', megapixels: 4.29 },
    { name: '1888x2272', ratio: 0.83, dimensions: '1888 / 2272', pixels: '1888x2272', megapixels: 4.29 },

    // Row 6
    { name: '3488x1216', ratio: 2.87, dimensions: '3488 / 1216', pixels: '3488x1216', megapixels: 4.24 },
    { name: '1216x3488', ratio: 0.35, dimensions: '1216 / 3488', pixels: '1216x3488', megapixels: 4.24 },

    { name: '2688x1568', ratio: 1.71, dimensions: '2688 / 1568', pixels: '2688x1568', megapixels: 4.21 },
    { name: '1568x2688', ratio: 0.58, dimensions: '1568 / 2688', pixels: '1568x2688', megapixels: 4.21 },

    { name: '2240x1888', ratio: 1.19, dimensions: '2240 / 1888', pixels: '2240x1888', megapixels: 4.23 },
    { name: '1888x2240', ratio: 0.84, dimensions: '1888 / 2240', pixels: '1888x2240', megapixels: 4.23 },

    // Row 7
    { name: '3392x1248', ratio: 2.72, dimensions: '3392 / 1248', pixels: '3392x1248', megapixels: 4.23 },
    { name: '1248x3392', ratio: 0.37, dimensions: '1248 / 3392', pixels: '1248x3392', megapixels: 4.23 },

    { name: '2656x1600', ratio: 1.66, dimensions: '2656 / 1600', pixels: '2656x1600', megapixels: 4.25 },
    { name: '1600x2656', ratio: 0.60, dimensions: '1600 / 2656', pixels: '1600x2656', megapixels: 4.25 },

    { name: '2208x1920', ratio: 1.15, dimensions: '2208 / 1920', pixels: '2208x1920', megapixels: 4.24 },
    { name: '1920x2208', ratio: 0.87, dimensions: '1920 / 2208', pixels: '1920x2208', megapixels: 4.24 },

    // Row 8
    { name: '3296x1280', ratio: 2.58, dimensions: '3296 / 1280', pixels: '3296x1280', megapixels: 4.22 },
    { name: '1280x3296', ratio: 0.39, dimensions: '1280 / 3296', pixels: '1280x3296', megapixels: 4.22 },

    { name: '2592x1632', ratio: 1.59, dimensions: '2592 / 1632', pixels: '2592x1632', megapixels: 4.23 },
    { name: '1632x2592', ratio: 0.63, dimensions: '1632 / 2592', pixels: '1632x2592', megapixels: 4.23 },

    { name: '2208x1952', ratio: 1.13, dimensions: '2208 / 1952', pixels: '2208x1952', megapixels: 4.31 },
    { name: '1952x2208', ratio: 0.88, dimensions: '1952 / 2208', pixels: '1952x2208', megapixels: 4.31 },

    // Row 9
    { name: '3232x1312', ratio: 2.46, dimensions: '3232 / 1312', pixels: '3232x1312', megapixels: 4.24 },
    { name: '1312x3232', ratio: 0.41, dimensions: '1312 / 3232', pixels: '1312x3232', megapixels: 4.24 },

    { name: '2560x1664', ratio: 1.54, dimensions: '2560 / 1664', pixels: '2560x1664', megapixels: 4.26 },
    { name: '1664x2560', ratio: 0.65, dimensions: '1664 / 2560', pixels: '1664x2560', megapixels: 4.26 },

    { name: '2176x1952', ratio: 1.11, dimensions: '2176 / 1952', pixels: '2176x1952', megapixels: 4.25 },
    { name: '1952x2176', ratio: 0.90, dimensions: '1952 / 2176', pixels: '1952x2176', megapixels: 4.25 },

    // Row 10
    { name: '3136x1344', ratio: 2.33, dimensions: '3136 / 1344', pixels: '3136x1344', megapixels: 4.21 },
    { name: '1344x3136', ratio: 0.43, dimensions: '1344 / 3136', pixels: '1344x3136', megapixels: 4.21 },

    { name: '2528x1696', ratio: 1.49, dimensions: '2528 / 1696', pixels: '2528x1696', megapixels: 4.29 },
    { name: '1696x2528', ratio: 0.67, dimensions: '1696 / 2528', pixels: '1696x2528', megapixels: 4.29 },

    { name: '2144x1984', ratio: 1.08, dimensions: '2144 / 1984', pixels: '2144x1984', megapixels: 4.25 },
    { name: '1984x2144', ratio: 0.93, dimensions: '1984 / 2144', pixels: '1984x2144', megapixels: 4.25 },

    // Row 11
    { name: '3072x1376', ratio: 2.23, dimensions: '3072 / 1376', pixels: '3072x1376', megapixels: 4.23 },
    { name: '1376x3072', ratio: 0.45, dimensions: '1376 / 3072', pixels: '1376x3072', megapixels: 4.23 },

    { name: '2496x1696', ratio: 1.47, dimensions: '2496 / 1696', pixels: '2496x1696', megapixels: 4.23 },
    { name: '1696x2496', ratio: 0.68, dimensions: '1696 / 2496', pixels: '1696x2496', megapixels: 4.23 },

    { name: '2112x2016', ratio: 1.05, dimensions: '2112 / 2016', pixels: '2112x2016', megapixels: 4.26 },
    { name: '2016x2112', ratio: 0.96, dimensions: '2016 / 2112', pixels: '2016x2112', megapixels: 4.26 },

    // Row 12
    { name: '3008x1408', ratio: 2.14, dimensions: '3008 / 1408', pixels: '3008x1408', megapixels: 4.24 },
    { name: '1408x3008', ratio: 0.47, dimensions: '1408 / 3008', pixels: '1408x3008', megapixels: 4.24 },

    { name: '2464x1728', ratio: 1.43, dimensions: '2464 / 1728', pixels: '2464x1728', megapixels: 4.26 },
    { name: '1728x2464', ratio: 0.70, dimensions: '1728 / 2464', pixels: '1728x2464', megapixels: 4.26 },
];

export const PAPER_SIZES: AspectRatio[] = [
    { name: 'A0', ratio: 1.414, dimensions: '9933 / 14043', pixels: '9933x14043', megapixels: 139.5 },
    { name: 'A1', ratio: 1.414, dimensions: '7016 / 9933', pixels: '7016x9933', megapixels: 69.7 },
    { name: 'A2', ratio: 1.414, dimensions: '4961 / 7016', pixels: '4961x7016', megapixels: 34.8 },
    { name: 'A3', ratio: 1.414, dimensions: '3508 / 4961', pixels: '3508x4961', megapixels: 17.4 },
    { name: 'A4', ratio: 1.414, dimensions: '2480 / 3508', pixels: '2480x3508', megapixels: 8.7 },
    { name: 'A5', ratio: 1.414, dimensions: '1748 / 2480', pixels: '1748x2480', megapixels: 4.3 },
];
