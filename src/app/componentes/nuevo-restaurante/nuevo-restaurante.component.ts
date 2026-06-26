import { Component, inject, Input, OnInit } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { IonicModule, ModalController, ToastController } from '@ionic/angular';
import { Firestore, collection, addDoc } from '@angular/fire/firestore';
import { Restaurante } from '../../interface/restaurante';
import { addIcons } from 'ionicons';
import { closeOutline, saveOutline } from 'ionicons/icons';

@Component({
  selector: 'app-nuevo-restaurante',
  standalone: true,
  imports: [IonicModule, ReactiveFormsModule],
  templateUrl: './nuevo-restaurante.component.html'
})
export class NuevoRestauranteComponent implements OnInit {

  @Input() territorios: string[] = [];
  @Input() localidades: string[] = [];

  firestore = inject(Firestore);
  modalCtrl = inject(ModalController);
  toastCtrl = inject(ToastController);
  fb = inject(FormBuilder);

  localidadesFiltradas: string[] = [];
  guardando = false;

  form: FormGroup = this.fb.group({
    documentName:    ['', Validators.required],
    address:         ['', Validators.required],
    phone:           [''],
    locality:        ['', Validators.required],
    territory:       ['', Validators.required],
    web:             [''],
    email:           ['', Validators.email],
    postalCode:      [''],
    restorationType: [''],
    michelinStar:    ['0'],
    repsolSun:       ['0'],
  });

  constructor() {
    addIcons({ closeOutline, saveOutline });
  }

  ngOnInit() {
    this.localidadesFiltradas = this.localidades;

    // Al cambiar territorio, filtra localidades
    this.form.get('territory')?.valueChanges.subscribe(territorio => {
      this.form.get('locality')?.setValue('');
      // Si el padre pasa todas las localidades sin filtrar,
      // aquí no podemos filtrar por territorio sin los datos completos.
      // Se filtrará desde el home pasando solo las localidades del territorio.
      this.localidadesFiltradas = this.localidades;
    });
  }

  cerrar() {
    this.modalCtrl.dismiss(null);
  }

  async guardar() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.guardando = true;
    try {
      const nuevo: Partial<Restaurante> = {
        ...this.form.value,
        // Campos técnicos con valor vacío por defecto
        documentDescription: '', templateType: '', localityQ: '',
        qualityQ: '', qualityIconDescription: '', accesibility: '',
        accesibilityIconDescription: '', marks: '', physical: '',
        visual: '', auditive: '', intellectual: '', organic: '',
        qualityAssurance: '', tourismEmail: '', importance: '',
        room: '', productClub: '', visit: '', capacity: '',
        store: '', gastronomical: '', surfing: '', recomended: '',
        recomendedURLIcon: '', recomendedIconDescription: '',
        restaurant: '', bodega: '', latitudelongitude: '',
        latwgs84: '', lonwgs84: '', placename: '', municipality: '',
        municipalitycode: '', postalcode: '', territorycode: '',
        country: '', countrycode: '', webpage: '', friendlyUrl: '',
        physicalUrl: '', dataXML: '', metadataXML: '', zipFile: ''
      };

      await addDoc(collection(this.firestore, 'restaurantesColleccion'), nuevo);
      await this.mostrarToast('✅ Restaurante añadido correctamente', 'success');
      this.modalCtrl.dismiss({ guardado: true });

    } catch (error: any) {
      const msg = error?.code === 'permission-denied'
        ? '❌ Sin permisos en Firebase.'
        : '❌ Error al guardar. Revisa tu conexión.';
      await this.mostrarToast(msg, 'danger');
    } finally {
      this.guardando = false;
    }
  }

  private async mostrarToast(mensaje: string, color: 'success' | 'danger') {
    const toast = await this.toastCtrl.create({
      message: mensaje, duration: 3000, color, position: 'bottom',
      buttons: [{ text: 'X', role: 'cancel' }]
    });
    await toast.present();
  }

  esInvalido(campo: string): boolean {
    const control = this.form.get(campo);
    return !!(control?.invalid && control?.touched);
  }
}