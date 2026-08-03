// *****************************************************************************
// IMPORTS
// *****************************************************************************
import { Component, input, effect, viewChild, ElementRef, OnDestroy } from '@angular/core';

// *****************************************************************************
// IMPORTS — Ionic y Chart.js
//
// Chart.js es una librería JavaScript que dibuja gráficas interactivas sobre
// elementos HTML <canvas>. Se instala con: npm install chart.js
//
// Importamos:
//  · Chart → la clase principal; cada instancia representa una gráfica
//  · registerables → array con TODOS los tipos de gráfica y componentes
//    predefinidos (barras, donuts, escalas, tooltips, leyendas, etc.)
// *****************************************************************************
import { IonicModule } from '@ionic/angular';
import { Chart, registerables } from 'chart.js';
import { Restaurante } from '../../interface/restaurante';

// *****************************************************************************
// REGISTRO GLOBAL DE CHART.JS
//
// Chart.js usa un sistema de plugins modulares: si no registras un componente,
// no está disponible. Con ...registerables registramos de una vez todo lo que
// viene incluido en la librería (tipos bar, doughnut, line; escalas lineales,
// categóricas; plugin de tooltip, leyenda, título, etc.).
//
// Esto se hace UNA SOLA VEZ fuera de la clase para que no se repita en cada
// instancia del componente.
// *****************************************************************************
Chart.register(...registerables);

@Component({
  selector: 'app-graficos',
  standalone: true,
  imports: [IonicModule],
  templateUrl: './graficos.component.html',
  styleUrls: ['./graficos.component.scss']
})
export class GraficosComponent implements OnDestroy {

  // *************************************************************************
  // INPUT CON SEÑAL (Angular 17+)
  //
  // input<T>() es la forma moderna de recibir datos del componente padre.
  // Equivale a @Input() pero devuelve un Signal, lo que permite leerlo con
  // restaurantes() y reaccionar automáticamente a sus cambios mediante effect().
  //
  // El componente padre (home.page.html) lo usa así:
  //   <app-graficos [restaurantes]="restaurantesFiltrados()">
  // Pasámos restaurantesFiltrados() (un signal de tipo Restaurante[]) como parámetro y el componente hijo lo recibe como restaurantes() (otro InputSignal<Restaurante[]>).
  // *************************************************************************
  restaurantes = input<Restaurante[]>([]);

  // *************************************************************************
  // REFERENCIAS al DOM con viewChild (Angular 17+)
  //
  // viewChild<T>('nombre') es la forma moderna de @ViewChild.
  // Devuelve un Signal<ElementRef | undefined> que apunta al elemento del
  // template marcado con la variable de referencia #nombre.
  //
  // · Es undefined HASTA que Angular termina de construir la vista (similar
  //   a ngAfterViewInit con @ViewChild).
  // · Una vez el DOM está listo, el signal se actualiza automáticamente
  //   y su cambio dispara el effect() del constructor.
  //
  // ElementRef<HTMLCanvasElement> nos da acceso al elemento <canvas> nativo
  // del navegador, que es lo que Chart.js necesita para dibujar.
  // *************************************************************************
  private canvasTerritorios = viewChild<ElementRef<HTMLCanvasElement>>('canvasTerritorios');
  private canvasMichelin    = viewChild<ElementRef<HTMLCanvasElement>>('canvasMichelin');
  private canvasLocalidades = viewChild<ElementRef<HTMLCanvasElement>>('canvasLocalidades');

  // *************************************************************************
  // MAPA DE INSTANCIAS DE GRÁFICA
  //
  // Cada llamada a new Chart(canvas, config) crea un objeto Chart que ocupa
  // el canvas y registra sus propios event listeners (hover, click, resize).
  //
  // Si intentamos crear una segunda gráfica sobre el mismo canvas sin destruir
  // la primera, Chart.js lanza el error: "Canvas is already in use".
  //
  // Guardamos las instancias en un Map<clave, Chart> para poder localizarlas
  // por nombre y destruirlas antes de redibujar.
  // *************************************************************************
  private charts = new Map<string, Chart>();

  // *************************************************************************
  // CONSTRUCTOR — Reactividad con effect()
  //
  // effect() registra una función que Angular vuelve a ejecutar
  // automáticamente cada vez que cambia cualquier signal que se lea dentro
  // de ella. Aquí leemos cuatro signals:
  //   · this.restaurantes()          → datos que llegan del padre
  //   · this.canvasTerritorios()     → referencia al <canvas> del gráfico 1
  //   · this.canvasMichelin()        → referencia al <canvas> del gráfico 2
  //   · this.canvasLocalidades()     → referencia al <canvas> del gráfico 3
  //
  // FLUJO DE EJECUCIÓN:
  //  1. Angular crea el componente → el effect se ejecuta por primera vez.
  //     Los tres viewChild() son todavía undefined (el DOM aún no existe).
  //     → El guard "if (!cT || !cM || !cL) return" detiene la ejecución.
  //
  //  2. Angular termina de construir la vista → los viewChild() se actualizan.
  //     El effect se vuelve a ejecutar. Ahora los canvas YA existen.
  //     → Se dibujan las tres gráficas con los datos actuales.
  //
  //  3. El usuario cambia un filtro 
  //     → restaurantesFiltrados() en el padre cambia
  //     → el signal input restaurantes() cambia 
  //     → el effect se ejecuta.
  //     → Las gráficas se redesdibujan con los nuevos datos automáticamente.
  // *************************************************************************
  constructor() {
    effect(() => {
      const data = this.restaurantes();
      const cT   = this.canvasTerritorios();
      const cM   = this.canvasMichelin();
      const cL   = this.canvasLocalidades();

      // Guard: salimos si el DOM todavía no tiene los canvas listos
      if (!cT || !cM || !cL) return;

      // nativeElement extrae el HTMLCanvasElement del wrapper de Angular
      this.renderTerritorios(data, cT.nativeElement);
      this.renderMichelin(data, cM.nativeElement);
      this.renderLocalidades(data, cL.nativeElement);
    });
  }

  // *************************************************************************
  // destroyChart — limpieza obligatoria antes de redibujar
  //
  // chart.destroy() libera el canvas, elimina los event listeners internos
  // y marca la instancia como destruida. Sin esto, al redibujar aparecería
  // el error "Canvas is already in use" de Chart.js.
  // *************************************************************************
  private destroyChart(key: string) {
    this.charts.get(key)?.destroy();
    this.charts.delete(key);
  }

  // *************************************************************************
  // GRÁFICO 1 — Barras verticales: restaurantes por territorio
  //
  // TIPO: 'bar' (barras verticales por defecto)
  //
  // PREPARACIÓN DE DATOS:
  //   Usamos un Map<territorio, conteo> para agrupar y contar en una sola
  //   pasada por el array. Después convertimos el Map en un array de pares
  //   [territorio, cantidad] y lo ordenamos de mayor a menor.
  //
  // COLORES:
  //   COLORS[i % COLORS.length] asigna un color por índice ciclando el array cuando hay más barras que colores definidos.
  //   El sufijo 'bb' en hex es el canal alpha (bb hex = ~73% opacidad),
  //   lo que da el efecto de relleno semitransparente con borde sólido.
  // *************************************************************************
  private renderTerritorios(data: Restaurante[], canvas: HTMLCanvasElement) {
    this.destroyChart('territorios');

    const counts = new Map<string, number>();
    data.forEach(r => {
      const t = r.territory?.trim() || 'Desconocido';
      counts.set(t, (counts.get(t) ?? 0) + 1);
    });

    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    const COLORS  = ['#3880ff', '#2dd36f', '#eb445a', '#ffc409', '#5260ff', '#92949c'];

    this.charts.set('territorios', new Chart(canvas, {
      type: 'bar',
      data: {
        // labels: etiquetas del eje X (nombres de los territorios)
        labels: sorted.map(([k]) => k),
        datasets: [{
          label: 'Restaurantes',
          // data: array de valores numéricos, uno por cada label
          data: sorted.map(([, v]) => v),
          backgroundColor: sorted.map((_, i) => COLORS[i % COLORS.length] + 'bb'),
          borderColor:     sorted.map((_, i) => COLORS[i % COLORS.length]),
          borderWidth: 2,
          // borderRadius: redondea las esquinas superiores de cada barra
          borderRadius: 8,
          // borderSkipped: false → redondea TODAS las esquinas, no solo la superior
          borderSkipped: false,
        }]
      },
      options: {
        // responsive: true → la gráfica se redimensiona al cambiar el contenedor
        responsive: true,
        // maintainAspectRatio: false → permite controlar la altura desde CSS
        // (si fuera true, Chart.js impondría proporción 2:1 ancho/alto)
        maintainAspectRatio: false,
        plugins: {
          // Ocultamos la leyenda porque el título y el eje X ya identifican los datos
          legend: { display: false },
          title: {
            display: true,
            text: 'Restaurantes por territorio',
            font: { size: 15, weight: 'bold' },
            color: '#333',
            padding: { bottom: 14 }
          },
          tooltip: {
            callbacks: {
              // Sobreescribimos el texto del tooltip para personalizar el mensaje
              label: ctx => ` ${ctx.parsed.y} restaurantes`
            }
          }
        },
        scales: {
          y: {
            // beginAtZero: true → el eje Y empieza en 0, evita gráficas engañosas
            beginAtZero: true,
            ticks: { stepSize: 1, color: '#555' },
            grid: { color: 'rgba(0,0,0,0.06)' }
          },
          x: {
            ticks: { color: '#555' },
            // Ocultamos las líneas verticales de la cuadrícula en el eje X
            grid: { display: false }
          }
        }
      }
    }));
  }

  // *************************************************************************
  // GRÁFICO 2 — Barras horizontales: distinciones gastronómicas
  //
  // TIPO: 'bar' con indexAxis: 'y' (gira 90° → barras horizontales)
  //   · Por defecto 'bar' dibuja barras verticales (eje de categorías en X).
  //   · Con indexAxis: 'y' el eje de categorías pasa al Y → barras horizontales.
  //   · Las escalas también se invierten: los valores numéricos van en X
  //     y las etiquetas en Y.
  //
  // CONTEOS NO EXCLUSIVOS (se solapan a propósito):
  //   Un restaurante CON AMBAS distinciones se cuenta en las 3 barras.
  //   Esto responde a "¿cuántos tienen Repsol?" / "¿cuántos tienen Michelin?"
  //   independientemente de si también tienen la otra.
  //
  // NOTA SOBRE ESTE DATASET:
  //   En los datos actuales ningún restaurante tiene SOLO Michelin (todos los
  //   que tienen Michelin también tienen Repsol), de ahí que la barra Michelin
  //   y la barra "Ambas" tengan el mismo valor.
  // *************************************************************************
  private renderMichelin(data: Restaurante[], canvas: HTMLCanvasElement) {
    this.destroyChart('michelin');

    const conRepsol   = data.filter(r => Number(r.repsolSun)   > 0).length;
    const conMichelin = data.filter(r => Number(r.michelinStar) > 0).length;
    const conAmbas    = data.filter(r => Number(r.repsolSun) > 0 && Number(r.michelinStar) > 0).length;

    this.charts.set('michelin', new Chart(canvas, {
      type: 'bar',
      data: {
        labels: ['☀️ Soles Repsol', '⭐ Estrellas Michelin', '⭐☀️ Ambas distinciones'],
        datasets: [{
          label: 'Restaurantes',
          data: [conRepsol, conMichelin, conAmbas],
          backgroundColor: ['#eb445abb', '#ffc409bb', '#5260ffbb'],
          borderColor:     ['#eb445a',   '#ffc409',   '#5260ff'],
          borderWidth: 2,
          borderRadius: 6,
        }]
      },
      options: {
        // indexAxis: 'y' es la única diferencia con un gráfico de barras vertical
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          title: {
            display: true,
            text: 'Distinciones gastronómicas',
            font: { size: 15, weight: 'bold' },
            color: '#333',
            padding: { bottom: 14 }
          },
          tooltip: {
            callbacks: {
              // En barras horizontales el valor está en ctx.parsed.x (no .y)
              label: ctx => ` ${ctx.parsed.x} restaurantes`
            }
          }
        },
        scales: {
          // Al ser horizontal, los valores numéricos van en el eje X
          x: {
            beginAtZero: true,
            ticks: { stepSize: 1, color: '#555' },
            grid: { color: 'rgba(0,0,0,0.06)' }
          },
          // Las etiquetas (categorías) van en el eje Y
          y: {
            ticks: { color: '#555' },
            grid: { display: false }
          }
        }
      }
    }));
  }

  // *************************************************************************
  // GRÁFICO 3 — Donut: top 10 localidades con más restaurantes
  //
  // TIPO: 'doughnut' (donut = variante del gráfico de sectores/pie con hueco)
  //   · 'pie' rellena todo el círculo.
  //   · 'doughnut' deja un hueco en el centro (visualmente más limpio).
  //   · NO usa escalas (scales), porque no hay ejes X/Y.
  //   · La leyenda es especialmente importante aquí porque los colores son
  //     la única forma de identificar cada sector.
  //
  // PREPARACIÓN DE DATOS:
  //   1. Contamos restaurantes por localidad con un Map.
  //   2. Convertimos a array, ordenamos de mayor a menor y tomamos los 10 primeros.
  //   3. Asignamos un color distinto a cada localidad usando PALETTE[i % 10].
  //
  // TOOLTIP CON PORCENTAJE:
  //   Calculamos el total sumando todos los valores del dataset y dividimos
  //   el valor del sector entre el total para obtener el porcentaje.
  //
  // LEYENDA A LA DERECHA (position: 'right'):
  //   Con 10 etiquetas, colocarla abajo ocuparía demasiado espacio vertical.
  //   A la derecha aprovecha el ancho de pantalla y el donut queda centrado.
  //
  // hoverOffset: cuando el usuario pone el cursor sobre un sector, éste se
  //   desplaza hacia afuera N píxeles, dando retroalimentación visual clara.
  // *************************************************************************
  private renderLocalidades(data: Restaurante[], canvas: HTMLCanvasElement) {
    this.destroyChart('localidades');

    const counts = new Map<string, number>();
    data.forEach(r => {
      const loc = r.locality?.trim() || 'Desconocida';
      counts.set(loc, (counts.get(loc) ?? 0) + 1);
    });

    const top10 = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);

    const PALETTE = [
      '#3880ff', '#2dd36f', '#eb445a', '#ffc409', '#5260ff',
      '#0cd1e8', '#f7a34b', '#a855f7', '#10dc60', '#92949c'
    ];

    this.charts.set('localidades', new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: top10.map(([k]) => k),
        datasets: [{
          data: top10.map(([, v]) => v),
          backgroundColor: top10.map((_, i) => PALETTE[i % PALETTE.length] + 'bb'),
          borderColor:     top10.map((_, i) => PALETTE[i % PALETTE.length]),
          borderWidth: 2,
          // hoverOffset: desplaza el sector N px hacia afuera al pasar el ratón
          hoverOffset: 10
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: { padding: 12, usePointStyle: true, font: { size: 12 }, color: '#333' }
          },
          title: {
            display: true,
            text: 'Top 10 localidades con más restaurantes',
            font: { size: 15, weight: 'bold' },
            color: '#333',
            padding: { bottom: 14 }
          },
          tooltip: {
            callbacks: {
              label: ctx => {
                // Calculamos el total sumando todos los valores del dataset
                const total = (ctx.dataset.data as number[]).reduce((a: number, b: number) => a + b, 0);
                const pct = total > 0 ? Math.round((ctx.parsed / total) * 100) : 0;
                return ` ${ctx.label}: ${ctx.parsed} restaurantes (${pct}%)`;
              }
            }
          }
        }
        // Los gráficos doughnut/pie no usan la propiedad 'scales'
      }
    }));
  }

  // *************************************************************************
  // ngOnDestroy — limpieza al destruir el componente
  //
  // Angular llama a este método justo antes de destruir el componente
  // (p.ej. cuando el usuario cambia de pestaña a "Tabla" o sale de la página).
  //
  // Es imprescindible destruir todas las instancias de Chart para:
  //  · Liberar la memoria que ocupan los datos y el canvas.
  //  · Eliminar los event listeners de redimensionado y hover.
  //  · Evitar memory leaks acumulativos si el usuario alterna vistas muchas veces.
  // *************************************************************************
  ngOnDestroy() {
    this.charts.forEach(c => c.destroy());
    this.charts.clear();
  }
}
