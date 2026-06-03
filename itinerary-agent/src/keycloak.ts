import Keycloak from 'keycloak-js';

const keycloak = new Keycloak({
    url: 'https://auth.quangntran.com',
    realm: 'travel-platform',
    clientId: 'itinerary-agent',
});

export default keycloak;
