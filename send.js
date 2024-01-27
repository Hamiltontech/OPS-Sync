const xmlrpc = require('xmlrpc');
const fs = require('fs');
const parse = require('csv-parse/lib/sync');

// Odoo configuration
const odooUrl = 'http://your-odoo-server-url';
const odooDb = 'your-odoo-database';
const odooUsername = 'your-odoo-username';
const odooPassword = 'your-odoo-password';

// Odoo XML-RPC client
const odooClient = xmlrpc.createClient({ url: `${odooUrl}/xmlrpc/2/object` });

// Function to authenticate and get the Odoo user ID
function authenticateOdoo(callback) {
  odooClient.methodCall('execute_kw', [
    odooDb,
    1, // User ID 1 is the admin user, change it if needed
    odooPassword,
    'res.users',
    'search',
    [[['login', '=', odooUsername]]],
  ], (error, uid) => {
    if (error) {
      console.error('Authentication failed:', error);
      return;
    }

    console.log('Authenticated successfully. User ID:', uid);
    callback(uid);
  });
}

// Function to create or update a product in Odoo
function createOrUpdateProduct(uid, productData) {
  const { product_name, quantity } = productData;

  // Search for the product by name
  odooClient.methodCall('execute_kw', [
    odooDb,
    uid,
    odooPassword,
    'product.product',
    'search',
    [[['name', '=', product_name]]],
  ], (error, productIds) => {
    if (error) {
      console.error('Error searching for product:', error);
      return;
    }

    // If the product exists, update its quantity
    if (productIds.length > 0) {
      const productId = productIds[0];
      odooClient.methodCall('execute_kw', [
        odooDb,
        uid,
        odooPassword,
        'stock.quant',
        'write',
        [[productId], { 'quantity': quantity }],
      ], (error) => {
        if (error) {
          console.error('Error updating product quantity:', error);
        } else {
          console.log(`Updated quantity for product "${product_name}"`);
        }
      });
    } else {
      // If the product doesn't exist, create it
      odooClient.methodCall('execute_kw', [
        odooDb,
        uid,
        odooPassword,
        'product.product',
        'create',
        [{
          'name': product_name,
          'type': 'product',
        }],
      ], (error, newProductId) => {
        if (error) {
          console.error('Error creating product:', error);
        } else {
          console.log(`Created product "${product_name}" with ID ${newProductId}`);

          // Create a stock.quant record for the new product
          odooClient.methodCall('execute_kw', [
            odooDb,
            uid,
            odooPassword,
            'stock.quant',
            'create',
            [{
              'product_id': newProductId,
              'quantity': quantity,
            }],
          ], (error) => {
            if (error) {
              console.error('Error creating stock.quant:', error);
            } else {
              console.log(`Created stock.quant for product "${product_name}"`);
            }
          });
        }
      });
    }
  });
}

// Read the CSV file
const csvFilePath = 'products.csv';
const fileContent = fs.readFileSync(csvFilePath, 'utf-8');
const products = parse(fileContent, { columns: true });

// Authenticate and perform actions
authenticateOdoo((uid) => {
  products.forEach(productData => createOrUpdateProduct(uid, productData));
});
