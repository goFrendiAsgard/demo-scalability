if [ -z "$HTTP_PORT" ]
then
    echo "You should provide HTTP_PORT."
    echo "Since you don't provide any, we will assume HTTP_PORT=3001"
    HTTP_PORT=3001
fi

if [ -z "$SERVER_NAME" ]
then
    echo "You should provide SERVER_NAME."
    echo "Since you don't provide any, we will assume SERVER_NAME=Server1"
    SERVER_NAME=Server1
fi

node backend.js