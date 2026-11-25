FROM python:3.12-alpine
WORKDIR /app
COPY . /app
ENV PORT=8080 HOST=0.0.0.0
VOLUME /app/data
EXPOSE 8080
CMD ["python", "server/server.py"]
