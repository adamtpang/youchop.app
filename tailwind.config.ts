import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './extension/**/*.{html,js,ts,jsx,tsx}',
  ],
  theme: {
  	container: {
  		center: true,
  		padding: '1rem',
  		screens: {
  			'2xl': '400px'
  		}
  	},
  	extend: {
  		fontFamily: {
  			sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
  		},
  		colors: {
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			// Coolors Palette: https://coolors.co/ff6b6b-4ecdc4-45b7d1-f7b731-5f27cd
  			coral: {
  				DEFAULT: '#FF6B6B',
  				light: '#FF8E8E',
  				dark: '#E65555',
  			},
  			teal: {
  				DEFAULT: '#4ECDC4',
  				light: '#6FD9D1',
  				dark: '#3CB8AF',
  			},
  			sky: {
  				DEFAULT: '#45B7D1',
  				light: '#69C5DC',
  				dark: '#33A3BE',
  			},
  			amber: {
  				DEFAULT: '#F7B731',
  				light: '#F9C55E',
  				dark: '#E5A920',
  			},
  			violet: {
  				DEFAULT: '#5F27CD',
  				light: '#7D4FD7',
  				dark: '#4A1FA3',
  			},
  			primary: {
  				'50': '#f0f4ff',
  				'100': '#dfe8ff',
  				'200': '#c6d7ff',
  				'300': '#a3bcff',
  				'400': '#7e96ff',
  				'500': '#667eea',
  				'600': '#5563d1',
  				'700': '#4a4fb8',
  				'800': '#3f4295',
  				'900': '#373977',
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				'50': '#f5f3ff',
  				'100': '#ede9fe',
  				'200': '#ddd6fe',
  				'300': '#c4b5fd',
  				'400': '#a78bfa',
  				'500': '#764ba2',
  				'600': '#6d43a0',
  				'700': '#5e3a8a',
  				'800': '#4c2f70',
  				'900': '#3f2659',
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			}
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		keyframes: {
  			'fade-in': {
  				'0%': {
  					opacity: '0'
  				},
  				'100%': {
  					opacity: '1'
  				}
  			},
  			'slide-up': {
  				'0%': {
  					transform: 'translateY(4px)',
  					opacity: '0'
  				},
  				'100%': {
  					transform: 'translateY(0)',
  					opacity: '1'
  				}
  			},
  			pop: {
  				'0%': {
  					transform: 'scale(0.95)',
  					opacity: '0'
  				},
  				'100%': {
  					transform: 'scale(1)',
  					opacity: '1'
  				}
  			}
  		},
  		animation: {
  			'fade-in': 'fade-in 0.15s ease-out',
  			'slide-up': 'slide-up 0.2s ease-out',
  			pop: 'pop 0.15s ease-out'
  		}
  	}
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
