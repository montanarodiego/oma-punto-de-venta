# Auditoría OmaTech POS

## CRÍTICO
1. Sync roto (negocioIdActivo siempre null, reautenticarDesdeToken no se llama)
11. Licencia nunca verificada al arranque para usuarios existentes
16. Flujo Firebase re-auth inexistente

## ALTO
2. Cancelaciones/devoluciones no marcan artículos pending en sync
3. Ganancia bruta sobreestimada con descuentos por ítem
4. Farmacia: IVA por producto definido pero nunca usado en cobro
13. articulos.remove() sin soft-delete, FK violation no manejada
17. Sync solo cubre 3 de ~12 tablas
18. Credenciales viejas en DB sin migration de limpieza

## MEDIO
5. Fechas: UTC vs. local -> ventas de noche en día incorrecto en informes
6. Modal anular muestra solo tickets de hoy
14. turnoActivo=null si DB falla -> ventas sin turno_id
19. Farmacia IVA por producto feature incompleta
20. Sin tests
7. Inconsistencia estado vigente vs != cancelada en informes

## BAJO
8. promoCache sin invalidación
9. Ticket prueba impresora no verifica acentos
10. mailer.js con remitente hardcodeado
15. bcrypt hash en localStorage
21. clientes sin soft-delete ni tombstone
