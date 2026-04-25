import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { ProductModule } from './modules/product/product.module';
import { CategoryModule } from './modules/category/category.module';
import { BrandModule } from './modules/brand/brand.module';
import { OrderModule } from './modules/order/order.module';
import { MarketingModule } from './modules/marketing/marketing.module';
import { CmsModule } from './modules/cms/cms.module';
import { SystemModule } from './modules/system/system.module';
import { CustomerModule } from './modules/customer/customer.module';
import { TagModule } from './modules/tag/tag.module';
import { MediaModule } from './modules/media/media.module';
import { CartModule } from './modules/cart/cart.module';
import { WishlistModule } from './modules/wishlist/wishlist.module';
import { FeedbackModule } from './modules/feedback/feedback.module';
import { PaymentModule } from './modules/payment/payment.module';

import { AttributeModule } from './modules/product/attribute/attribute.module';
import { SpecificationModule } from './modules/product/specification/specification.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    CustomerModule,
    ProductModule,
    AttributeModule,
    SpecificationModule,
    CategoryModule,
    BrandModule,
    OrderModule,
    MarketingModule,
    CmsModule,
    SystemModule,
    TagModule,
    MediaModule,
    CartModule,
    WishlistModule,
    FeedbackModule,
    PaymentModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
