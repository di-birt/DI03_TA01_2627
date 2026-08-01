import { Component, inject } from '@angular/core';
import { IonicModule, ModalController } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { addIcons } from 'ionicons';
import { closeOutline, addOutline } from 'ionicons/icons';
import { Restaurante } from '../../interface/restaurante';

@Component({
  selector: 'app-add-restaurante-modal',
  standalone: true,
  imports: [IonicModule, FormsModule],
  templateUrl: 'add-restaurante-modal.component.html'
})
export class AddRestauranteComponent {

  private modalCtrl = inject(ModalController);

  nombre     = '';
  localidad  = '';
  territorio = '';
  direccion  = '';
  telefono   = '';
  web        = '';

  constructor() {
    addIcons({ closeOutline, addOutline });
  }

  cancelar() {
    this.modalCtrl.dismiss(null, 'cancel');
  }

  confirmar() {
    if (!this.nombre.trim()) return;

    const nuevo: Restaurante = {
      documentName: this.nombre.trim(),
      locality:     this.localidad.trim(),
      territory:    this.territorio.trim(),
      address:      this.direccion.trim(),
      phone:        this.telefono.trim(),
      web:          this.web.trim(),
      documentDescription: '', templateType: '', localityQ: '', qualityQ: '',
      qualityIconDescription: '', accesibility: '', accesibilityIconDescription: '',
      marks: '', physical: '', visual: '', auditive: '', intellectual: '', organic: '',
      qualityAssurance: '', tourismEmail: '', importance: '', room: '', productClub: '',
      visit: '', capacity: '', store: '', gastronomical: '', surfing: '', postalCode: '',
      restorationType: '', recomended: '', recomendedURLIcon: '', recomendedIconDescription: '',
      restaurant: '', bodega: '', michelinStar: '', repsolSun: '', latitudelongitude: '',
      latwgs84: '', lonwgs84: '', placename: '', municipality: '', municipalitycode: '',
      postalcode: '', territorycode: '', country: '', countrycode: '', email: '',
      webpage: '', friendlyUrl: '', physicalUrl: '', dataXML: '', metadataXML: '', zipFile: ''
    };

    this.modalCtrl.dismiss(nuevo, 'confirm');
  }
}
