import { Model } from '@nozbe/watermelondb';
import { field, date, readonly } from '@nozbe/watermelondb/decorators';

export default class Transaction extends Model {
  static table = 'transactions';

  @field('user_id') userId!: string;
  @field('type') type!: 'receita' | 'despesa';
  @field('amount') amount!: number;
  @field('category') category?: string;
  @field('description') description?: string;
  @field('date') date!: string;
  @field('payment_method') paymentMethod?: string;
  @field('client_id') clientId?: string;
  
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;
}
