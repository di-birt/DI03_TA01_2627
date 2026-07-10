import { Injectable, inject } from '@angular/core';
import { Firestore, collection, getDocs, addDoc, deleteDoc, doc } from '@angular/fire/firestore';
import { Restaurante } from '../interface/restaurante';

@Injectable({ providedIn: 'root' })
export class RestauranteService {

  private firestore = inject(Firestore);
  private readonly COLECCION = 'restaurantesColeccion';

  // Obtiene todos los restaurantes de Firestore
  async getAll(): Promise<Restaurante[]> {
    const snapshot = await getDocs(collection(this.firestore, this.COLECCION));
    return snapshot.docs.map(d => d.data() as Restaurante);
  }

  // Borra todos los documentos de la colección
  async deleteAll(): Promise<void> {
    const snapshot = await getDocs(collection(this.firestore, this.COLECCION));
    await Promise.all(
      snapshot.docs.map(d => deleteDoc(doc(this.firestore, this.COLECCION, d.id)))
    );
  }

  // Añade un array de restaurantes a la colección
  async addAll(restaurantes: Restaurante[]): Promise<void> {
    const col = collection(this.firestore, this.COLECCION);
    for (const r of restaurantes) {
      await addDoc(col, r);
    }
  }
}
