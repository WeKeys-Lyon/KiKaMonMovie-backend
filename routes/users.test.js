jest.mock('expo-server-sdk', () => {
  return { Expo: class {} };
});
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');

describe('Test des routes Users', () => {

    afterAll(async () => {
    await mongoose.connection.close();
  });

  it('doit refuser la connexion avec un mauvais email ou mot de passe', async () => {
    
    const response = await request(app)
      .post('/users/signin')
      .send({
        email: 'hacker@pirate.com',
        password: 'mauvaismotdepasse'
      });


    expect(response.statusCode).toBe(400);
    expect(response.body.result).toBe(false);
  });

});