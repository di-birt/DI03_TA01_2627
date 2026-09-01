import { Component, input, effect, viewChild, ElementRef, OnDestroy } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { Chart, registerables } from 'chart.js';
import { Seleccion } from '../../interface/seleccion';

// Registra todos los tipos de gráfica y componentes de Chart.js de una vez.
Chart.register(...registerables);

@Component({
  selector: 'app-graficos',
  standalone: true,
  imports: [IonicModule],
  templateUrl: './graficos.component.html',
  styleUrls: ['./graficos.component.scss']
})
export class GraficosComponent implements OnDestroy {

  // input<T>() recibe datos del componente padre mediante un Signal.
  // El padre lo usa así: <app-graficos [selecciones]="selecciones">
  selecciones = input<Seleccion[]>([]);

  // viewChild apunta al <canvas #canvasGoles> del template.
  // Es undefined hasta que Angular construye la vista.
  private canvasGoles = viewChild<ElementRef<HTMLCanvasElement>>('canvasGoles');

  // Guarda la instancia de Chart para destruirla antes de redibujar.
  // Sin esto Chart.js lanzaría el error "Canvas is already in use".
  // En este ejemplo, solo tendremos un único chart 'goles', pero usar un Map con claves descriptivas es buena práctica cuando el componente puede crecer con más gráficas en el futuro.
  private charts = new Map<string, Chart>();

  // effect() se re-ejecuta automáticamente cada vez que cambia selecciones()
  // o canvasGoles(). La primera vez los canvas aún no existen (undefined) →
  // el guard los detiene. Cuando Angular los crea, el effect vuelve a dispararse.
  constructor() {
    effect(() => {
      const data   = this.selecciones();
      const canvas = this.canvasGoles();
      if (!canvas) return;
      this.renderGoles(data, canvas.nativeElement);
    });
  }

  // Destruye la instancia anterior para liberar el canvas antes de redibujar.
  private destroyChart(key: string) {
    this.charts.get(key)?.destroy();
    this.charts.delete(key);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Gráfico de barras verticales: goles por selección en la UEFA Euro 2024
  //
  // type: 'bar' → barras verticales (indexAxis por defecto es 'x').
  // Los datos se ordenan de mayor a menor antes de dibujar.
  // COLORS[i % COLORS.length] cicla la paleta cuando hay más barras que colores.
  // El sufijo 'bb' en hex equivale a ~73 % de opacidad (relleno semitransparente).
  // ──────────────────────────────────────────────────────────────────────────
  private renderGoles(data: Seleccion[], canvas: HTMLCanvasElement) {
    this.destroyChart('goles');

    const sorted = [...data].sort((a, b) => b.goles - a.goles);
    const COLORS = ['#3880ff', '#2dd36f', '#eb445a', '#ffc409', '#5260ff',
                    '#0cd1e8', '#f7a34b', '#a855f7', '#10dc60', '#92949c'];

    this.charts.set('goles', new Chart(canvas, {
      type: 'bar',
      data: {
        labels: sorted.map(s => s.seleccion),
        datasets: [{
          label: 'Goles marcados',
          data: sorted.map(s => s.goles),
          backgroundColor: sorted.map((_, i) => COLORS[i % COLORS.length] + 'bb'),
          borderColor:     sorted.map((_, i) => COLORS[i % COLORS.length]),
          borderWidth: 2,
          borderRadius: 8,
          // borderSkipped: false → redondea todas las esquinas, no solo la superior
          borderSkipped: false,
        }]
      },
      options: {
        // responsive: true → la gráfica se redimensiona con el contenedor
        responsive: true,
        // maintainAspectRatio: false → la altura se controla desde CSS
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          title: {
            display: true,
            text: 'Goles por selección — UEFA Euro 2024',
            font: { size: 15, weight: 'bold' },
            color: '#333',
            padding: { bottom: 14 }
          },
          tooltip: {
            callbacks: {
              label: ctx => ` ${ctx.parsed.y} goles en ${sorted[ctx.dataIndex].partidos} partidos`
            }
          }
        },
        scales: {
          //tick -> Valores de los ejes.
          y: {
            // beginAtZero: true → el eje Y empieza en 0, evita gráficas engañosas
            beginAtZero: true, 
            //stepSize:1 -> Los números del eje y aparecen en intervalos de 1 (0,1,2,3,...)
            ticks: { stepSize: 1, color: '#555' },
            //grid: El color de las líneas del fondo. (Se ven en horizontal para marcar el nivel del eje Y). Color 0,0,0 + opacidad 0.06
            grid: { color: 'rgba(0,0,0,0.06)' } 
          },
          x: {
            //maxRotation: 45 -> Si las etiquetas del eje X son largas, las rota hasta un máximo de 45 grados.
            ticks: { color: '#555', maxRotation: 45 },
            // En este caso no queremos mostrar las líneas en el eje X.
            grid: { display: false }
          }
        }
      }
    }));
  }

  // Angular llama a ngOnDestroy antes de destruir el componente.
  // Destruimos todas las instancias de Chart para liberar memoria y
  // evitar memory leaks si el usuario navega varias veces.
  ngOnDestroy() {
    this.charts.forEach(c => c.destroy());
    this.charts.clear();
  }
}
