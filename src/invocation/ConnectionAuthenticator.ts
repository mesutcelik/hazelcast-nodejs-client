import * as Promise from 'bluebird';
import {ClientAuthenticationCodec} from '../codec/ClientAuthenticationCodec';
import HazelcastClient from '../HazelcastClient';
import {ClientAuthenticationCustomCodec} from '../codec/ClientAuthenticationCustomCodec';
import {ClientConnection} from './ClientConnection';
import {ClusterService} from './ClusterService';
import {BuildInfoLoader} from '../BuildInfoLoader';
import ClientMessage = require('../ClientMessage');

export class ConnectionAuthenticator {

    private connection: ClientConnection;
    private client: HazelcastClient;
    private clusterService: ClusterService;

    constructor(connection: ClientConnection, client: HazelcastClient) {
        this.connection = connection;
        this.client = client;
        this.clusterService = this.client.getClusterService();
    }

    authenticate(ownerConnection: boolean): Promise<void> {
        var credentials: ClientMessage = this.createCredentials(ownerConnection);

        return this.client.getInvocationService()
            .invokeOnConnection(this.connection, credentials)
            .then((msg: ClientMessage) => {
                var authResponse = ClientAuthenticationCodec.decodeResponse(msg);
                if (authResponse.status === 0) {
                    this.connection.address = authResponse.address;
                    if (ownerConnection) {
                        this.clusterService.uuid = authResponse.uuid;
                        this.clusterService.ownerUuid = authResponse.ownerUuid;
                    }
                } else {
                    throw new Error('Could not authenticate connection to ' + this.connection.getAddress().toString());
                }
            });
    }


    createCredentials(ownerConnection: boolean): ClientMessage {
        var groupConfig = this.client.getConfig().groupConfig;
        var uuid: string = this.clusterService.uuid;
        var ownerUuid: string = this.clusterService.ownerUuid;

        var customCredentials = this.client.getConfig().customCredentials;

        var clientMessage: ClientMessage;

        const clientVersion = BuildInfoLoader.getClientVersion();

        if (customCredentials != null) {
            var credentialsPayload = this.client.getSerializationService().toData(customCredentials);

            clientMessage = ClientAuthenticationCustomCodec.encodeRequest(
                credentialsPayload, uuid, ownerUuid, ownerConnection, 'NJS', 1, clientVersion);
        } else {
            clientMessage = ClientAuthenticationCodec.encodeRequest(
                groupConfig.name, groupConfig.password, uuid, ownerUuid, ownerConnection, 'NJS', 1, clientVersion);

        }

        return clientMessage;
    }
}
