FROM osgeo/gdal:alpine-ultrasmall-latest

RUN adduser --system georectify

RUN mkdir /data
RUN chown georectify -R /data

RUN mkdir /app
RUN chown georectify -R /app
WORKDIR /app

RUN apk add bash
RUN apk add --update nodejs npm

COPY ./app /app
RUN cd /app \
  && npm install

EXPOSE 8080
CMD ["node", "index.js", "/data"]
