import type { ImageAsset, ParsedWorkbook } from '../domain/types'

const headers = ['Seller SKU', '商品标题', '售价', 'Currency Code', '库存', '品牌名称', '商品类目']

export const demoWorkbook: ParsedWorkbook = {
  fileName: 'listinglint-demo.csv',
  sheets: [
    {
      name: 'CSV',
      headers,
      rows: [
        {
          sourceRow: 2,
          values: {
            'Seller SKU': 'BOTTLE-001',
            商品标题: 'Insulated stainless steel water bottle with leakproof lid',
            售价: 24.9,
            'Currency Code': 'USD',
            库存: 120,
            品牌名称: 'Northline',
            商品类目: 'Sports & Outdoors'
          }
        },
        {
          sourceRow: 3,
          values: {
            'Seller SKU': 'LAMP-002',
            商品标题: 'Desk lamp',
            售价: 0,
            'Currency Code': 'usd',
            库存: -3,
            品牌名称: null,
            商品类目: 'Home & Kitchen'
          }
        },
        {
          sourceRow: 4,
          values: {
            'Seller SKU': 'BOTTLE-001',
            商品标题: 'Best seller reusable water bottle for everyday travel',
            售价: 18.5,
            'Currency Code': 'USD',
            库存: 48,
            品牌名称: 'Northline',
            商品类目: 'Sports & Outdoors'
          }
        },
        {
          sourceRow: 5,
          values: {
            'Seller SKU': 'BAD SKU 04',
            商品标题: 'Portable travel organizer with adjustable compartments',
            售价: 15.8,
            'Currency Code': 'EUR',
            库存: 12.5,
            品牌名称: 'Packwise',
            商品类目: 'Travel Accessories'
          }
        },
        {
          sourceRow: 6,
          values: {
            'Seller SKU': 'CABLE-005',
            商品标题: 'Braided USB C charging cable two metre length',
            售价: 9.9,
            'Currency Code': 'USD',
            库存: 200,
            品牌名称: 'Voltway',
            商品类目: null
          }
        },
        {
          sourceRow: 7,
          values: {
            'Seller SKU': 'BAG-006',
            商品标题: 'Lightweight foldable shopping bag with reinforced handles',
            售价: 12.3,
            'Currency Code': 'USD',
            库存: 65,
            品牌名称: 'Carrywell',
            商品类目: 'Bags'
          }
        }
      ]
    }
  ]
}

export const demoImages: ImageAsset[] = [
  {
    name: 'BOTTLE-001_1.jpg',
    sku: 'BOTTLE-001',
    extension: 'jpg',
    size: 820_000,
    width: 1600,
    height: 1600
  },
  {
    name: 'LAMP-002_1.jpg',
    sku: 'LAMP-002',
    extension: 'jpg',
    size: 310_000,
    width: 720,
    height: 720
  },
  {
    name: 'CABLE-005_1.gif',
    sku: 'CABLE-005',
    extension: 'gif',
    size: 450_000,
    width: null,
    height: null
  },
  {
    name: 'ORPHAN-999_1.png',
    sku: 'ORPHAN-999',
    extension: 'png',
    size: 240_000,
    width: 1200,
    height: 1200
  }
]

export const demoCsv = `Seller SKU,商品标题,售价,Currency Code,库存,品牌名称,商品类目
BOTTLE-001,Insulated stainless steel water bottle with leakproof lid,24.9,USD,120,Northline,Sports & Outdoors
LAMP-002,Desk lamp,0,usd,-3,,Home & Kitchen
BOTTLE-001,Best seller reusable water bottle for everyday travel,18.5,USD,48,Northline,Sports & Outdoors
BAD SKU 04,Portable travel organizer with adjustable compartments,15.8,EUR,12.5,Packwise,Travel Accessories
CABLE-005,Braided USB C charging cable two metre length,9.9,USD,200,Voltway,
BAG-006,Lightweight foldable shopping bag with reinforced handles,12.3,USD,65,Carrywell,Bags`
