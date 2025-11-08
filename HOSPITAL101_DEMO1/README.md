```bash
# HOSPITAL101_DEMO
รันในDocker
พิมพ์
docker compose up -d --build
หากต้องการลบContainerเพราะไม่ได้ใช้แล้ว
docker compose down -v
databaseจะสร้างให้เองเลยแต่ถ้าอยากเข้าเช็ค
#เข้าsqldevเพื่อเช็คฐานข้อมูล
NAME = <ตั้งตามต้องการ>
USERNAME = HOSPITAL
PASSWORD = hospital101
HOSTNAME = localhost
PORT = 1521
SERVICENAME = XEPDB1 #SERVICENAMEไม่ใช่SID

เข้าเว็ปไซต์ได้โดยเข้าใช้งานผ่านหน้าdashbord
http://localhost:8081/appointment_create.html

```