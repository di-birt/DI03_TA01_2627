import { Component, signal, computed, inject } from '@angular/core';
import { Firestore, collection, addDoc, getDocs, deleteDoc, doc } from '@angular/fire/firestore';
import restaurantesJSON from '../../assets/datos/restaurantes.json';
import { IonicModule } from '@ionic/angular';
import { AlertController, ToastController, LoadingController } from '@ionic/angular';
import { Restaurante } from '../interface/restaurante';


import { addIcons } from 'ionicons';
import { 
  star, sunny, cloudUploadOutline, restaurantOutline,
  closeCircleOutline, searchOutline, filterOutline, trashOutline,
  globeOutline, warningOutline, informationCircleOutline,
  downloadOutline, lockClosedOutline
} from 'ionicons/icons';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [IonicModule],
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss']
})
export class HomePage {

  //Inject se usa para obtener instancias de servicios en componentes standalone sin necesidad de un constructor explícito
  firestore = inject(Firestore);
  alertCtrl = inject(AlertController);
  toastCtrl = inject(ToastController);
  loadingCtrl = inject(LoadingController);
  restaurantes: Restaurante[] = restaurantesJSON as Restaurante[];

  //signals para manejar el estado de la aplicación de forma reactiva y eficiente
  restaurantesCargados = signal<Restaurante[]>([]);
  textoBusqueda = signal('');
  territorioSeleccionado = signal('');
  cargando = signal(false);
  importando = signal(false);
  localidadesSeleccionadas = signal<Set<string>>(new Set());
  estadoCarga = signal('');
  estadoImportacion = signal('');

  constructor() {
    //Añadimos los iconos que vamos a usar en el HTML para que estén disponibles globalmente
    addIcons({
      star, sunny, cloudUploadOutline, restaurantOutline,
      closeCircleOutline, searchOutline, filterOutline, trashOutline,
      globeOutline, warningOutline, informationCircleOutline, downloadOutline,
      lockClosedOutline
    });
  }

  //computed para derivar datos basados en el estado actual de los signals, evitando cálculos innecesarios y mejorando el rendimiento
  hayDatos = computed(() => this.restaurantesCargados().length > 0);

  hayFiltrosActivos = computed(() =>
    !!this.textoBusqueda() ||
    !!this.territorioSeleccionado() ||
    this.localidadesSeleccionadas().size > 0
  );

  territoriosFiltrados = computed(() => {
    const territorios = this.restaurantesCargados().map(r => r.territory);
    return Array.from(new Set(territorios)).sort();
  });

  localidadesFiltradasPorTerritorio = computed(() => {
    let lista = this.restaurantesCargados();
    const territorio = this.territorioSeleccionado().toLowerCase().trim();
    if (territorio) {
      lista = lista.filter(r => r.territory?.toLowerCase().trim() === territorio);
    }
    const localities = lista.map(r => r.locality?.trim()).filter((l): l is string => !!l);
    return Array.from(new Set(localities)).sort();
  });

  restaurantesFiltrados = computed(() => {
    let lista = this.restaurantesCargados();

    const texto = this.textoBusqueda().toLowerCase().trim();
    if (texto) {
      lista = lista.filter(r => r.documentName.toLowerCase().includes(texto));
    }

    const territorio = this.territorioSeleccionado().toLowerCase().trim();
    if (territorio) {
      lista = lista.filter(r => r.territory.toLowerCase().trim() === territorio);
    }

    const seleccionadas = this.localidadesSeleccionadas();
    if (seleccionadas.size > 0) {
      lista = lista.filter(r => seleccionadas.has(r.locality?.trim() || ''));
    }

    return lista;
  });

  get localidadesSeleccionadasArray(): string[] {
    return Array.from(this.localidadesSeleccionadas());
  }

  onTerritorioChange(event: any) {
    this.territorioSeleccionado.set(event.detail.value);
    const nuevasLocalidades = new Set(
      Array.from(this.localidadesSeleccionadas()).filter(loc =>
        this.localidadesFiltradasPorTerritorio().includes(loc)
      )
    );
    this.localidadesSeleccionadas.set(nuevasLocalidades);
  }

  onLocalidadesChange(event: any) {
    this.localidadesSeleccionadas.set(new Set(event.detail.value));
  }

  limpiarLocalidades() {
    this.localidadesSeleccionadas.set(new Set());
  }

  eliminarLocalidad(loc: string) {
    const nuevas = new Set(this.localidadesSeleccionadas());
    nuevas.delete(loc);
    this.localidadesSeleccionadas.set(nuevas);
  }

  limpiarTodosFiltros() {
    this.textoBusqueda.set('');
    this.territorioSeleccionado.set('');
    this.localidadesSeleccionadas.set(new Set());
  }

  limpiarTerritorio() {
    if (this.localidadesSeleccionadas().size === 0) {
      this.territorioSeleccionado.set('');
    }
  }

  private async mostrarToast(mensaje: string, color: 'success' | 'danger' | 'warning') {
    const toast = await this.toastCtrl.create({
      message: mensaje,
      duration: 3000,
      color,
      position: 'bottom',
      buttons: [{ text: 'X', role: 'cancel' }]
    });
    await toast.present();
  }





  async confirmarImportacion() {
    const alert = await this.alertCtrl.create({
      header: '⚠️ Confirmar actualización',
      message: `Esta acción borrará <strong>${this.restaurantes.length} restaurantes</strong>
                actuales y los reemplazará con los datos del archivo local. ¿Deseas continuar?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Sí, actualizar', role: 'confirm', handler: () => this.importarJSON() }
      ]
    });
    await alert.present();
  }

  async importarJSON() {
    this.importando.set(true);
    const datosCollection = collection(this.firestore, 'restaurantesColleccion');

    const loading = await this.loadingCtrl.create({
      message: 'Borrando datos anteriores...',
      backdropDismiss: false
    });
    await loading.present();

    try {
      const snapshot = await getDocs(datosCollection);
      await Promise.all(
        snapshot.docs.map(d => deleteDoc(doc(this.firestore, 'restaurantesColleccion', d.id)))
      );

      loading.message = 'Subiendo restaurantes...';
      this.estadoImportacion.set('Subiendo restaurantes...');

      for (const r of this.restaurantes) {
        await addDoc(datosCollection, r);
      }

      await loading.dismiss();
      this.estadoImportacion.set('');
      await this.mostrarToast('✅ Restaurantes actualizados correctamente', 'success');

    } catch (error: any) {
      await loading.dismiss();
      console.error('Error al importar JSON:', error);
      this.estadoImportacion.set('');
      const msg = error?.code === 'permission-denied'
        ? '❌ Sin permisos en Firebase. Revisa las reglas de seguridad.'
        : '❌ Error al actualizar. Revisa tu conexión a internet.';
      await this.mostrarToast(msg, 'danger');
    } finally {
      this.importando.set(false);
    }
  }

  async cargarDatos() {
    this.cargando.set(true);
    this.estadoCarga.set('Cargando restaurantes...');
    const datosCollection = collection(this.firestore, 'restaurantesColleccion');

    try {
      const snapshot = await getDocs(datosCollection);
      this.restaurantesCargados.set(snapshot.docs.map(d => d.data() as Restaurante));
      this.estadoCarga.set('');
      await this.mostrarToast(`✅ ${snapshot.docs.length} restaurantes cargados`, 'success');

    } catch (error: any) {
      console.error('Error al cargar datos:', error);
      this.estadoCarga.set('');
      // ✅ H9: Mensaje específico según tipo de error
      const msg = error?.code === 'permission-denied'
        ? '❌ Sin permisos en Firebase. Revisa las reglas de seguridad.'
        : '❌ Error al cargar datos. Revisa tu conexión a internet.';
      await this.mostrarToast(msg, 'danger');
    } finally {
      this.cargando.set(false);
    }
  }

  async exportarJSON() {
    // 1. Obtiene todos los documentos de la colección en Firestore
  const snapshot = await getDocs(collection(this.firestore, 'restaurantesColleccion'));
  // 2. Extrae solo los datos de cada documento (sin metadatos de Firestore como id, ref, etc.)
  const datos = snapshot.docs.map(d => d.data());
  // 3. Convierte el array de objetos a texto JSON con formato legible (2 espacios de indentación)
  const blob = new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' });
  // 4. Crea una URL temporal en memoria que apunta a ese blob
  const url = URL.createObjectURL(blob);
  // 5. Crea un elemento <a> invisible en el DOM
  const a = document.createElement('a');
  // 6. Le asigna la URL del blob como destino del enlace
  a.href = url;
  // 7. Le indica al navegador que en vez de navegar, debe descargar con ese nombre
  a.download = 'restaurantes_backup.json';
  // 8. Simula un clic en el enlace → el navegador dispara la descarga
  a.click();
  }

  estrellasMichelin(r: Restaurante): number[] {
    const count = Number(r.michelinStar) || 0;
    return Array.from({ length: count }, (_, i) => i);
  }

  repsolSoles(r: Restaurante): number[] {
    const n = Number(r.repsolSun) || 0;
    return Array.from({ length: n }, (_, i) => i);
  }
}