import { Component } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { barChartOutline } from 'ionicons/icons';
import { GraficosComponent } from '../components/graficos/graficos.component';
import { Seleccion } from '../interface/seleccion';
import seleccionesJSON from '../../assets/datos/eurocopa2024.json';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [IonicModule, GraficosComponent],
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss']
})
export class HomePage {

  // Los datos se cargan directamente desde el JSON local.
  // No hace falta ninguna llamada asíncrona ni servicio externo.
  selecciones: Seleccion[] = seleccionesJSON as Seleccion[];

  constructor() {
    addIcons({ barChartOutline });
  }
}
